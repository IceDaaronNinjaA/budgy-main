'use strict';
// All goal mutations are authenticated, idempotent Firestore transactions.
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { pathToFileURL } = require('node:url');
const path=require('node:path');
const ledgerPromise=import(pathToFileURL(path.join(__dirname,'../shared/LedgerCalculations.js')).href);
const calcPromise=import(pathToFileURL(path.join(__dirname,'../shared/SavingsCalculations.js')).href);
const ID=/^[A-Za-z0-9_-]{1,90}$/;
const FIELDS={
 create:['requestId','goalId','name','targetCents','startDate','deadlineDate'],
 update:['requestId','goalId','name','targetCents','startDate','deadlineDate'],
 pause:['requestId','goalId','paused'],
 contribute:['requestId','goalId','amountCents','effectiveDate'],
 withdraw:['requestId','goalId','amountCents','effectiveDate'],
};
function fail(error){
 if(error instanceof HttpsError)throw error;
 if(error instanceof TypeError||error instanceof RangeError)throw new HttpsError('invalid-argument',error.message);
 throw error;
}
function parse(request,action,calc){
 const uid=request.auth?.uid;
 if(typeof uid!=='string'||!uid)throw new HttpsError('unauthenticated','Sign in first.');
 const data=request.data;
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!FIELDS[action].includes(k)))
  throw new HttpsError('invalid-argument','Unrecognized goal command.');
 for(const key of ['requestId','goalId'])if(typeof data[key]!=='string'||!ID.test(data[key]))
  throw new HttpsError('invalid-argument',`Invalid ${key}.`);
 const command={...data};
 if(action==='create'||action==='update'){
  if(typeof data.name!=='string'||!data.name.trim()||data.name.trim().length>80)
   throw new HttpsError('invalid-argument','name must be 1–80 characters.');
  if(!Number.isSafeInteger(data.targetCents)||data.targetCents<=0)
   throw new HttpsError('invalid-argument','targetCents must be positive safe-integer cents.');
  try{if(calc.dayNumber(data.deadlineDate)<calc.dayNumber(data.startDate))throw new RangeError('Deadline precedes start date');}
  catch(error){fail(error);}
  command.name=data.name.trim();
 }
 if(action==='pause'&&typeof data.paused!=='boolean')throw new HttpsError('invalid-argument','paused must be boolean.');
 if(action==='contribute'||action==='withdraw'){
  if(!Number.isSafeInteger(data.amountCents)||data.amountCents<=0)
   throw new HttpsError('invalid-argument','amountCents must be positive safe-integer cents.');
  try{calc.dayNumber(data.effectiveDate);}catch(error){fail(error);}
 }
 return {uid,command};
}
function validAccounts(snapshot,ledger){
 if(!snapshot.exists)throw new HttpsError('failed-precondition','Initialize your account first.');
 const previous=snapshot.data(), accounts=previous.accounts;
 if(!accounts||typeof accounts!=='object'||Array.isArray(accounts)||Object.values(accounts).some(v=>!Number.isSafeInteger(v)))
  throw new HttpsError('failed-precondition','Invalid stored accounts.');
 let summary;try{summary=ledger.ledgerSummary({accounts,receipts:{}});}catch{throw new HttpsError('failed-precondition','Invalid ledger summary.');}
 if(Object.entries(summary).some(([key,value])=>previous[key]!==value))
  throw new HttpsError('failed-precondition','Stored summary does not match account balances.');
 return accounts;
}
async function perform(request,action){
 const [ledger,calc]=await Promise.all([ledgerPromise,calcPromise]);
 const {uid,command:cmd}=parse(request,action,calc);
 const db=getFirestore(),base=db.collection('users').doc(uid);
 const goalRef=base.collection('savingsGoals').doc(cmd.goalId);
 const receiptRef=base.collection('operations').doc(cmd.requestId);
 const summaryRef=base.collection('summaries').doc('current');
 const funding=action==='contribute'||action==='withdraw';
 const eventId=`goal_${action}_${cmd.requestId}`;
 const eventRef=base.collection('journal').doc(eventId);
 const fingerprint=JSON.stringify({action,...cmd,requestId:undefined});
 return db.runTransaction(async tx=>{
  const [receipt,goalSnap,summarySnap]=await Promise.all([tx.get(receiptRef),tx.get(goalRef),tx.get(summaryRef)]);
  if(receipt.exists){
   const prior=receipt.data();
   if(prior.fingerprint!==fingerprint)throw new HttpsError('already-exists','Conflicting requestId.');
   return {...prior.result,duplicate:true};
  }
  if(!summarySnap.exists)throw new HttpsError('failed-precondition','Initialize your account first.');
  if(action==='create'&&goalSnap.exists)throw new HttpsError('already-exists','Goal ID exists.');
  if(action!=='create'&&!goalSnap.exists)throw new HttpsError('not-found','Savings goal not found.');
  const previous=goalSnap.exists?goalSnap.data():null;
  if(previous&&previous.archived)throw new HttpsError('failed-precondition','Goal is archived.');
  if(funding&&previous.paused)throw new HttpsError('failed-precondition','Goal is paused.');
  const accounts=validAccounts(summarySnap,ledger),key=`goal:${cmd.goalId}`;
  const savedCents=accounts[key]??0;
  if(!Number.isSafeInteger(savedCents)||savedCents<0)throw new HttpsError('failed-precondition','Goal reserve is inconsistent.');
  let nextGoal,updatedAccounts=accounts,summary=ledger.ledgerSummary({accounts,receipts:{}});
  if(funding){
   let event,state;
   try{
    const meta={eventId,requestId:cmd.requestId,effectiveDate:cmd.effectiveDate};
    event=action==='contribute'?ledger.allocate(meta,cmd.amountCents,key):ledger.release(meta,cmd.amountCents,key);
    state=ledger.applyEvent({accounts,receipts:{}},event);
   }catch(error){fail(error);}
   updatedAccounts=state.accounts;
   summary=ledger.ledgerSummary(state);
   tx.create(eventRef,{...event,goalId:cmd.goalId,schemaVersion:1,createdAt:FieldValue.serverTimestamp()});
   tx.update(summaryRef,{...summary,accounts:updatedAccounts,lastEventId:eventId,updatedAt:FieldValue.serverTimestamp()});
  }
  if(action==='create')nextGoal={goalId:cmd.goalId,name:cmd.name,targetCents:cmd.targetCents,
   startDate:cmd.startDate,deadlineDate:cmd.deadlineDate,paused:false,archived:false};
  else if(action==='update')nextGoal={...previous,name:cmd.name,targetCents:cmd.targetCents,startDate:cmd.startDate,deadlineDate:cmd.deadlineDate};
  else if(action==='pause')nextGoal={...previous,paused:cmd.paused};
  else nextGoal=previous;
  const currentSaved=updatedAccounts[key]??0;
  const asOfDate=funding?cmd.effectiveDate:nextGoal.startDate;
  let progress;try{progress=calc.savingsProgress({targetCents:nextGoal.targetCents,savedCents:currentSaved,
   startDate:nextGoal.startDate,deadlineDate:nextGoal.deadlineDate,asOfDate});}catch(error){fail(error);}
  const result={goalId:cmd.goalId,name:nextGoal.name,targetCents:nextGoal.targetCents,
   startDate:nextGoal.startDate,deadlineDate:nextGoal.deadlineDate,paused:nextGoal.paused,
   ...progress,...(funding?{eventId,...summary}:{})};
  if(action==='create')tx.create(goalRef,{...nextGoal,schemaVersion:1,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  if(action==='update')tx.update(goalRef,{name:cmd.name,targetCents:cmd.targetCents,startDate:cmd.startDate,deadlineDate:cmd.deadlineDate,updatedAt:FieldValue.serverTimestamp()});
  if(action==='pause')tx.update(goalRef,{paused:cmd.paused,updatedAt:FieldValue.serverTimestamp()});
  tx.create(receiptRef,{requestId:cmd.requestId,fingerprint,kind:`savings_${action}`,
   status:'committed',eventId:funding?eventId:null,result,createdAt:FieldValue.serverTimestamp()});
  return {...result,duplicate:false};
 });
}
module.exports={
 createSavingsGoal:req=>perform(req,'create'),
 updateSavingsGoal:req=>perform(req,'update'),
 setSavingsGoalPaused:req=>perform(req,'pause'),
 contributeToSavingsGoal:req=>perform(req,'contribute'),
 withdrawFromSavingsGoal:req=>perform(req,'withdraw'),
};
