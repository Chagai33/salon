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

import { initializeApp } from 'firebase-admin/app';
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

initializeApp();

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
  const snapshot = await getFirestore()
    .doc(`branches/${branchId}/members/${uid}`)
    .get();

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
      // ⚠️ הגוף של גוגל אינו מוחזר ללקוח. הוא יכול להחזיק את המפתח בהד.
      logger.error('gemini failed', { status: response.status });
      throw new HttpsError('unavailable', 'modelFailed');
    }

    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new HttpsError('unavailable', 'emptyAnswer');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new HttpsError('unavailable', 'notJson');
    }

    const days = sanitiseDays(parsed, monthKey);
    logger.info('board image read', { branchId, monthKey, days: days.length });

    // ⚠️ ומחזירה ואינה כותבת. המנהלת רואה, מסמנת, ורק אז נכתב.
    // CLAUDE.md, אזור ליבה 4.
    return { model: MODEL, days };
  },
);
