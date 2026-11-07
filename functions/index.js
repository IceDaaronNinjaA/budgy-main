const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

initializeApp();

const db = getFirestore();

// Import the existing financial calculation engine.
// We reuse it rather than creating a second implementation.
const ledgerModule = import(
  pathToFileURL(
    path.resolve(__dirname, "../src/domain/LedgerCalculations.js")
  ).href
);

exports.backendHealthCheck = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in."
      );
    }

    return {
      status: "ok",
      service: "budgy-financial-backend",
      authenticated: true
    };
  }
);

// Initialize a user's financial account.
exports.initializeAccount = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in."
      );
    }

    const uid = request.auth.uid;
    const { requestId, amountCents, effectiveDate } = request.data || {};

    const { openingBalance, emptyLedger, applyEvent, ledgerSummary } =
      await ledgerModule;

    const validId = /^[A-Za-z0-9_-]{1,128}$/;

    if (typeof requestId !== "string" || !validId.test(requestId)) {
      throw new HttpsError(
        "invalid-argument",
        "A valid requestId is required."
      );
    }

    // Generate the event through our existing accounting engine.
    let event;

    try {
      event = openingBalance(
        {
          eventId: `opening_${requestId}`,
          requestId,
          effectiveDate
        },
        amountCents
      );
    } catch (error) {
      throw new HttpsError("invalid-argument", error.message);
    }

    const userRef = db.collection("users").doc(uid);
    const operationRef = userRef.collection("operations").doc(requestId);
    const journalRef = userRef.collection("journal").doc(event.eventId);
    const summaryRef = userRef.collection("summaries").doc("current");

    // A stable fingerprint identifies the exact requested operation.
    const fingerprint = JSON.stringify({
      eventType: event.eventType,
      amountCents: event.amountCents,
      effectiveDate: event.effectiveDate
    });

    return db.runTransaction(async (transaction) => {
      // All reads must occur before any writes.
      const operationDoc = await transaction.get(operationRef);
      const summaryDoc = await transaction.get(summaryRef);

      // Identical retries return the original result.
      if (operationDoc.exists) {
        const previous = operationDoc.data();

        if (previous.fingerprint !== fingerprint) {
          throw new HttpsError(
            "already-exists",
            "Request ID has already been used with different data."
          );
        }

        return {
          ...previous.result,
          duplicate: true
        };
      }

      // An account may only have one opening balance.
      if (summaryDoc.exists) {
        throw new HttpsError(
          "failed-precondition",
          "This financial account is already initialized."
        );
      }

      // Use the existing accounting engine to derive the summary.
      const state = applyEvent(emptyLedger(), event);
      const summary = ledgerSummary(state);

      const result = {
        eventId: event.eventId,
        ...summary
      };

      transaction.create(journalRef, {
        ...event,
        createdAt: new Date()
      });

      transaction.create(summaryRef, {
        ...summary,
        initializedAt: new Date(),
        lastEventId: event.eventId
      });

      transaction.create(operationRef, {
        requestId,
        fingerprint,
        eventId: event.eventId,
        status: "committed",
        result,
        createdAt: new Date()
      });

      return {
        ...result,
        duplicate: false
      };
    });
  }
);

exports.backendHealthCheck = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'You must be signed in to access this function.'
      );
    }

    return {
      status: 'ok',
      service: 'budgy-financial-backend',
      authenticated: true,
    };
  }
);