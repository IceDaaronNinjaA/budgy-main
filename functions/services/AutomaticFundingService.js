'use strict';
// Priority-based funding of existing open budget periods and unpaid bill occurrences.
// No background scheduler: runFundingCycle is an authenticated, explicit reconciliation command.
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const ledgerPromise = import(pathToFileURL(path.join(__dirname, '../shared/LedgerCalculations.js')).href);
const ID = /^[A-Za-z0-9_-]{1,90}$/;
function fail(code,message){throw new HttpsError(code,message);}
function parse(request, action) {
 const uid=request.auth?.uid;if(typeof uid!=='string'||!uid)fail('unauthenticated','Sign in first.');
 const d=request.data;
 const fields=action==='configure'?['requestId','kind','ruleId','enabled','targetCents','priority']:['requestId','effectiveDate'];
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!fields.includes(k)))fail('invalid-argument','Invalid funding command.');
 if(typeof d.requestId!=='string'||!ID.test(d.requestId))fail('invalid-argument','Invalid requestId.');
 if(action==='configure') {
  if(!['budget','bill'].includes(d.kind)||typeof d.ruleId!=='string'||!ID.test(d.ruleId))fail('invalid-argument','Invalid funding rule.');
  if(typeof d.enabled!=='boolean'||!Number.isSafeInteger(d.targetCents)||d.targetCents<0||!Number.isSafeInteger(d.priority)||d.priority<0||d.priority>1000000)fail('invalid-argument','Invalid funding settings.');
 } else {
  if(typeof d.effectiveDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveDate)||Number.isNaN(Date.parse(d.effectiveDate+'T00:00:00Z'))||new Date(d.effectiveDate+'T00:00:00Z').toISOString().slice(0,10)!==d.effectiveDate)fail('invalid-argument','Invalid effectiveDate.');
 }
 return {uid,d};
}
function accountsFrom(s,ledger){
 if(!s.exists)fail('failed-precondition','Initialize account first.');
 const previous=s.data(),accounts=previous.accounts;
 if(!accounts||typeof accounts!=='object'||Array.isArray(accounts)||Object.values(accounts).some(x=>!Number.isSafeInteger(x)))fail('failed-precondition','Invalid balances.');
 let sums;try{sums=ledger.ledgerSummary({accounts,receipts:{}});}catch{fail('failed-precondition','Invalid balances.');}
 if(Object.entries(sums).some(([k,v])=>previous[k]!==v))fail('failed-precondition','Inconsistent balances.');
 return accounts;
}
async function configureFundingRule(request){
 const {uid,d}=parse(request,'configure');const db=getFirestore(),base=db.collection('users').doc(uid);
 const ruleRef=base.collection(d.kind==='budget'?'budgetRules':'billRules').doc(d.ruleId);
 const receiptRef=base.collection('operations').doc(d.requestId);
 const fingerprint=JSON.stringify({action:'configureFundingRule',kind:d.kind,ruleId:d.ruleId,enabled:d.enabled,targetCents:d.targetCents,priority:d.priority});
 return db.runTransaction(async tx=>{
  const [receipt,rule]=await Promise.all([tx.get(receiptRef),tx.get(ruleRef)]);
  if(receipt.exists){if(receipt.data().fingerprint!==fingerprint)fail('already-exists','Conflicting requestId.');return {...receipt.data().result,duplicate:true};}
  if(!rule.exists)fail('not-found','Funding rule not found.');
  const result={kind:d.kind,ruleId:d.ruleId,autoFundingEnabled:d.enabled,fundingTargetCents:d.targetCents,fundingPriority:d.priority};
  tx.update(ruleRef,{autoFundingEnabled:d.enabled,fundingTargetCents:d.targetCents,fundingPriority:d.priority,updatedAt:FieldValue.serverTimestamp()});
  tx.create(receiptRef,{requestId:d.requestId,fingerprint,kind:'funding_configure',status:'committed',result,createdAt:FieldValue.serverTimestamp()});
  return {...result,duplicate:false};
 });
}
async function runFundingCycle(request){
 const {uid,d}=parse(request,'cycle'),ledger=await ledgerPromise,db=getFirestore(),base=db.collection('users').doc(uid);
 const receiptRef=base.collection('operations').doc(d.requestId),summaryRef=base.collection('summaries').doc('current');
 const fingerprint=JSON.stringify({action:'runFundingCycle',effectiveDate:d.effectiveDate});
 // Fetch candidate rule IDs first; re-read every rule and its active occurrence within
 // the transaction so that concurrent pause, close, pay and funding changes retry safely.
 const [budgetQuery,billQuery]=await Promise.all([base.collection('budgetRules').get(),base.collection('billRules').get()]);
 const candidates=[...budgetQuery.docs.map(x=>({kind:'budget',ref:x.ref,id:x.id})),...billQuery.docs.map(x=>({kind:'bill',ref:x.ref,id:x.id}))];
 if(candidates.length>40)fail('resource-exhausted','Funding cycle supports at most 40 rules.');
 return db.runTransaction(async tx=>{
  const [receipt,summarySnap,...ruleSnaps]=await Promise.all([tx.get(receiptRef),tx.get(summaryRef),...candidates.map(x=>tx.get(x.ref))]);
  if(receipt.exists){if(receipt.data().fingerprint!==fingerprint)fail('already-exists','Conflicting requestId.');return {...receipt.data().result,duplicate:true};}
  const accounts=accountsFrom(summarySnap,ledger);
  const items=[];
  for(let i=0;i<candidates.length;i++){
   const s=ruleSnaps[i];if(!s.exists)continue;
   const rule=s.data(),c=candidates[i];
   if(rule.paused||rule.autoFundingEnabled!==true)continue;
   const target=rule.fundingTargetCents,priority=rule.fundingPriority;
   if(!Number.isSafeInteger(target)||target<0||!Number.isSafeInteger(priority)||priority<0)fail('failed-precondition','Invalid funding configuration.');
   const activeId=c.kind==='budget'?rule.openPeriodId:rule.openOccurrenceId;
   if(!activeId)continue;
   items.push({...c,activeId,priority,target,createdMillis:rule.createdAt?.toMillis?.()??0});
  }
  // Read all active periods and occurrences before any writes.
  const snapshots=await Promise.all(items.map(c=>tx.get(base.collection(c.kind==='budget'?'budgetPeriods':'billOccurrences').doc(c.activeId))));
  const eligible=[];
  for(let i=0;i<items.length;i++){
   const c=items[i],s=snapshots[i];
   if(!s.exists)fail('failed-precondition','Active funding occurrence not found.');
   const o=s.data();
   if(c.kind==='budget'){
    if(o.budgetId!==c.id||o.status!=='open'||o.startDate>d.effectiveDate||o.endExclusiveDate<=d.effectiveDate)continue;
   }else if(o.billId!==c.id||o.status!=='unpaid')continue;
   const key=`${c.kind}:${c.id}`,available=accounts[key]??0;
   if(!Number.isSafeInteger(available)||available<0)fail('failed-precondition','Invalid reserve.');
   const target=c.kind==='bill'?Math.min(c.target,o.amountCents):c.target;
   if(!Number.isSafeInteger(target)||target<0)fail('failed-precondition','Invalid funding target.');
   eligible.push({...c,key,target,available,occurrence:s.ref,occurrenceData:o});
  }
  eligible.sort((a,b)=>a.priority-b.priority||a.createdMillis-b.createdMillis||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  let state={accounts,receipts:{}},availableUnallocated=Math.max(0,accounts.unallocated??0),seq=0;
  const allocations=[];
  for(const c of eligible){
   const outstanding=Math.max(0,c.target-c.available);
   const amount=Math.min(outstanding,availableUnallocated);
   if(amount>0){
    const eventId=`autofund_${d.requestId}_${seq++}`;
    const event=ledger.allocate({eventId,requestId:eventId,effectiveDate:d.effectiveDate},amount,c.key);
    state=ledger.applyEvent(state,event);
    tx.create(base.collection('journal').doc(eventId),{...event,autoFunding:true,kind:c.kind,ruleId:c.id,occurrenceId:c.activeId,schemaVersion:1,createdAt:FieldValue.serverTimestamp()});
    if(c.kind==='bill')tx.update(c.occurrence,{fundedCents:state.accounts[c.key],updatedAt:FieldValue.serverTimestamp()});
    availableUnallocated-=amount;
   }
   allocations.push({kind:c.kind,ruleId:c.id,occurrenceId:c.activeId,priority:c.priority,targetCents:c.target,allocatedCents:amount,remainingCents:outstanding-amount});
  }
  const summary=ledger.ledgerSummary(state);
  if(seq)tx.update(summaryRef,{...summary,accounts:state.accounts,lastEventId:`autofund_${d.requestId}_${seq-1}`,updatedAt:FieldValue.serverTimestamp()});
  const result={allocations,...summary,eventsCreated:seq};
  tx.create(receiptRef,{requestId:d.requestId,fingerprint,kind:'funding_cycle',status:'committed',result,createdAt:FieldValue.serverTimestamp()});
  return {...result,duplicate:false};
 });
}
module.exports={configureFundingRule,runFundingCycle};
