// functions/index.mjs
//
// קוראת תמונה של לוח חודשי ומחזירה את מה שהמודל הבין.
//
// ⚠️⚠️ ולמה כאן ולא ב-Netlify, אחרי שזה כבר נבנה שם פעם אחת:
//
//   1. הפונקציה ב-Netlify נפלה ב-504. שער Netlify סוגר חיבור סינכרוני אחרי
//      עשר שניות, וקריאת לוח של שישה עשר ימים אורכת יותר. כאן יש 300 שניות.
//   2. שם כתבתי ארבעים שורות שמאמתות חתימה של אסימון מול התעודות של גוגל.
//      `onCall` נותן את הזהות מהמערכת.
//   3. ⚠️ ושם לא הייתה דרך לבדוק שהקורא הוא מנהלת. כאן יש, והיא נבדקת.
//
// DOCS/PLANING/23-the-import-moved-to-firebase.md

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import {
  ALLOWED_TYPES,
  MAX_IMAGE_BYTES,
  MODEL,
  requestBodyFor,
  sanitiseDays,
} from './board-image.mjs';

/*
  ⚠️⚠️ האתחול נדחה לרגע הקריאה, ואינו בראש הקובץ.
  
  `initializeApp()` בראש הקובץ הפיל את הפריסה ב:
  
    Error: User code failed to load. Cannot determine backend specification.
    Timeout after 10000.
  
  ה-CLI טוען את המודול כדי לגלות אילו פונקציות יש בו, ובמכונה שאין בה
  הרשאות ענן האתחול מחפש אותן ונתקע. מה שרץ בזמן טעינת המודול חייב להיות
  הצהרות בלבד.
  https://firebase.google.com/docs/functions/tips#avoid_deployment_timeouts_during_initialization
*/
function firestore() {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
}

/**
 * ⚠️ המפתח יושב ב-Secret Manager ולא במשתנה סביבה רגיל.
 * הגדרה: `firebase functions:secrets:set GEMINI_API_KEY`
 */
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/**
 * ⚠️ הבדיקה שלא הייתה אפשרית ב-Netlify.
 *
 * `onCall` מוכיח מי הקורא, וזה מוכיח שהוא מנהל של הסניף הזה. בלי זה כל חבר
 * מאושר היה יכול לשרוף את המכסה, וגם לקרוא לוח של סניף שאינו שלו.
 */
async function assertManager(uid, branchId) {
  let snapshot;
  try {
    snapshot = await firestore().doc(`branches/${branchId}/members/${uid}`).get();
  } catch (error) {
    /*
      ⚠️ קריאה ל-Firestore יכולה להיכשל מסיבה שאינה המשתמש: חשבון השירות של
      הפונקציה צריך הרשאת גישה למסד, ובפרויקט חדש היא אינה מובטחת.
      בלי התפיסה הזו החריגה עלתה כ-500 בלי שום הסבר, וזה מה שקרה בפועל.
    */
    logger.error('member lookup failed', { branchId, message: String(error?.message ?? error) });
    throw new HttpsError('internal', 'memberLookupFailed');
  }

  const member = snapshot.data();
  if (!snapshot.exists || member?.status !== 'active' || member?.role !== 'manager') {
    throw new HttpsError('permission-denied', 'notManager');
  }
}

export const readBoardImage = onCall(
  {
    secrets: [GEMINI_API_KEY],
    // ⚠️ חמש דקות. זה מה שהיה חסר ב-Netlify, וזה כל הסיפור של ה-504.
    timeoutSeconds: 300,
    memory: '512MiB',
    // ⚠️ מופע אחד לכל היותר. זה כלי של עמותה, ומכסה שנשרפת היא כסף.
    maxInstances: 2,
    region: 'us-central1',
  },
  async (request) => {
    try {
      return await handle(request);
    } catch (error) {
      // ⚠️ HttpsError עובר כמו שהוא. כל השאר היה 500 בלי שום הסבר, וזה
      //    בדיוק מה שבעל המוצר קיבל במסך.
      if (error instanceof HttpsError) throw error;
      logger.error('unexpected', {
        message: String(error?.message ?? error),
        stack: error?.stack,
      });
      throw new HttpsError('internal', 'unexpected');
    }
  },
);

async function handle(request) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'noAuth');

    const { branchId, monthKey, mimeType, imageBase64 } = request.data ?? {};

    if (typeof branchId !== 'string' || !branchId) {
      throw new HttpsError('invalid-argument', 'badBranch');
    }
    if (!/^\d{4}-\d{2}$/.test(String(monthKey ?? ''))) {
      throw new HttpsError('invalid-argument', 'badMonth');
    }
    if (!ALLOWED_TYPES.includes(mimeType) || typeof imageBase64 !== 'string' || !imageBase64) {
      throw new HttpsError('invalid-argument', 'badImage');
    }
    // ⚠️ אורך base64 הוא בקירוב שליש יותר מהבתים, ולכן החישוב ולא האורך.
    if (Math.floor((imageBase64.length * 3) / 4) > MAX_IMAGE_BYTES) {
      throw new HttpsError('invalid-argument', 'tooLarge');
    }

    await assertManager(uid, branchId);

    const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY.value())}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBodyFor(monthKey, mimeType, imageBase64)),
    });

    if (!response.ok) {
      /*
        ⚠️ וגם גוף התשובה נרשם, ולא רק המספר.
        בלעדיו "המודל נכשל" יכול להיות שם מודל שאינו קיים, מכסה שנגמרה,
        או מפתח שאינו תקף, ואין שום דרך לדעת איזה מהם.
        ⚠️ והמפתח אינו בגוף: הוא יושב בשאילתת הכתובת, וגוגל אינה מחזירה אותו.
      */
      const detail = await response.text().catch(() => '');
      logger.error('gemini failed', { status: response.status, detail: detail.slice(0, 600) });
      throw new HttpsError('unavailable', 'modelFailed');
    }

    let body;
    try {
      body = await response.json();
    } catch (error) {
      // ⚠️ תשובה שאינה JSON. זו הייתה חריגה לא נתפסת, כלומר 500 בלי הסבר.
      logger.error('gemini body not json', { message: String(error?.message ?? error) });
      throw new HttpsError('unavailable', 'notJson');
    }

    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      // ⚠️ ולמה אין טקסט: חסימת תוכן, או סיום בגלל אורך. נרשם כדי שנדע.
      logger.error('gemini empty answer', {
        finishReason: body?.candidates?.[0]?.finishReason,
        promptFeedback: body?.promptFeedback,
      });
      throw new HttpsError('unavailable', 'emptyAnswer');
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      logger.error('gemini text not json', { head: String(text).slice(0, 300) });
      throw new HttpsError('unavailable', 'notJson');
    }

    const days = sanitiseDays(parsed, monthKey);
    logger.info('board image read', { branchId, monthKey, days: days.length });

    // ⚠️ ומחזירה ואינה כותבת. המנהלת רואה, מסמנת, ורק אז נכתב.
    // CLAUDE.md, אזור ליבה 4.
    return { model: MODEL, days };
}
