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

import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { firestore } from './admin-app.mjs';
import { ACTIONS, BRANCH_ID, deleteAfterFrom, isDue, planAction } from './branch-deletion.mjs';
import { codeAnswerFor, monthBounds, monthKeyNow } from './eligibility.mjs';
import {
  ALLOWED_TYPES,
  MAX_IMAGE_BYTES,
  MODEL,
  requestBodyFor,
  sanitiseDays,
} from './board-image.mjs';

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

      ⚠️⚠️ ו-`cause` ולא `message`, כי `message` הוא מפתח שמור.
      `entryFromArgs` של firebase-functions בונה `{...entry, severity}` ואז
      דורס את `message` בטקסט שלו, ולכשל ברמת ERROR הוא עוד עוטף אותו
      ב-`new Error().stack`. כלומר השדה שרשמתי נמחק, **והלוג הראה מחסנית של
      הלוגר עצמו ולא את השגיאה.** נשארנו עיוורים בדיוק במקום שבו הוספתי אבחון.
      node_modules/firebase-functions/lib/esm/logger/index.mjs
    */
    logger.error('member lookup failed', {
      branchId,
      uid,
      code: error?.code ?? error?.name ?? 'unknown',
      cause: String(error?.message ?? error),
    });
    throw new HttpsError('internal', 'memberLookupFailed');
  }

  /*
    ⚠️ ורשומה חסרה אינה מגיעה לכאן כשגיאה. `get` על מסמך שאינו קיים מצליח
    ומחזיר `exists: false`, ולכן זה `notManager` ולא `memberLookupFailed`.
    שתי ההודעות אינן מתחלפות, וזה מה שמאפשר להבחין בין השתיים ביומן.
  */
  const member = snapshot.data();
  if (!snapshot.exists || member?.status !== 'active' || member?.role !== 'manager') {
    logger.warn('not a manager', {
      branchId,
      uid,
      exists: snapshot.exists,
      status: member?.status ?? null,
      role: member?.role ?? null,
    });
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
      // ⚠️ `cause` ולא `message`. `message` מפתח שמור, והלוגר דורס אותו.
      logger.error('unexpected', {
        code: error?.code ?? error?.name ?? 'unknown',
        cause: String(error?.message ?? error),
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

    /*
      ⚠️⚠️ וחיוב אינו תקלה חולפת, ולכן אינו נושא את אותה הודעה.

      402 הוא קרדיטים שנגמרו ו-429 הוא מכסה. **"נסו שוב בעוד רגע" שולח את
      המנהלת ללופ** שלא ייגמר, כי אין שום דבר שהיא יכולה לעשות. זה קרה
      בפועל: הקוד היה תקין, והמסך אמר לנסות שוב.
    */
    if (response.status === 402 || response.status === 429) {
      throw new HttpsError('resource-exhausted', 'quotaExhausted');
    }
    throw new HttpsError('unavailable', 'modelFailed');
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    // ⚠️ תשובה שאינה JSON. זו הייתה חריגה לא נתפסת, כלומר 500 בלי הסבר.
    logger.error('gemini body not json', { cause: String(error?.message ?? error) });
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

// ---------- קוד הכניסה ----------
//
// ⚠️⚠️ אזור ליבה, ובשביל זה הסבב הזה קיים.
// DOCS/PLANING/15-the-code-is-not-enforced-yet.md
//
// הכלל במוצר: הקוד נחשף רק למי שמשובץ לפחות למשמרת אחת בחודש. עד עכשיו
// הסינון היה בדפדפן בלבד, ו-`allow read: if isActive(branchId)` נתן לכל חבר
// פעיל לקרוא את הקוד ישירות מהמסד.
//
// ⚠️ ולמה חוק המסד אינו יכול לעשות את זה לבדו: הזכאות היא שאילתה על אוסף
// המשמרות, וחוקי Firestore יודעים לקרוא מסמך בודד ואינם יודעים לשאול אוסף.
//
// ⚠️⚠️ והפתרון המפתה שנדחה: לשמור שדה זכאות על רשומת החבר. זו התיישנות.
// חבר שביטל משמרת והשדה לא התעדכן רואה קוד שאינו שלו, לנצח.
// DOCS/PLANING/02-the-data-model.md
//
// ⚠️ והחישוב עצמו אינו כאן אלא ב-`eligibility.mjs`, כדי שיהיה לו בדיקה.

/**
 * ⚠️ חבר פעיל, וכל תפקיד. מנהלת אינה צריכה את הפונקציה הזו, כי החוק מתיר לה
 * לקרוא את האוסף ישירות, והיא כן מגיעה לכאן בלי נזק.
 */
async function assertActiveMember(uid, branchId) {
  let snapshot;
  try {
    snapshot = await firestore().doc(`branches/${branchId}/members/${uid}`).get();
  } catch (error) {
    // ⚠️ `cause` ולא `message`. `message` מפתח שמור, והלוגר דורס אותו.
    logger.error('member lookup failed', {
      branchId,
      uid,
      code: error?.code ?? error?.name ?? 'unknown',
      cause: String(error?.message ?? error),
    });
    throw new HttpsError('internal', 'memberLookupFailed');
  }

  const member = snapshot.data();
  if (!snapshot.exists || member?.status !== 'active') {
    logger.warn('not an active member', {
      branchId,
      uid,
      exists: snapshot.exists,
      status: member?.status ?? null,
    });
    throw new HttpsError('permission-denied', 'notActive');
  }
}

export const readAccessCode = onCall(
  { maxInstances: 2, region: 'us-central1' },
  async (request) => {
    try {
      return await handleAccessCode(request);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('unexpected', {
        code: error?.code ?? error?.name ?? 'unknown',
        cause: String(error?.message ?? error),
        stack: error?.stack,
      });
      throw new HttpsError('internal', 'unexpected');
    }
  },
);

async function handleAccessCode(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'noAuth');

  const { branchId } = request.data ?? {};
  // ⚠️ מזהה ולא נתיב. `x/members/y` היה מכוון את הקריאה למקום אחר.
  if (typeof branchId !== 'string' || !BRANCH_ID.test(branchId)) {
    throw new HttpsError('invalid-argument', 'badBranch');
  }

  await assertActiveMember(uid, branchId);

  const db = firestore();
  // ⚠️ שעון השרת ולא מה שהדפדפן שלח. `now` שמגיע מהלקוח הוא `now` שאפשר
  // להזיז קדימה, ואז קוד עתידי הופך לנוכחי.
  const now = Date.now();

  /*
    ⚠️ אי שוויון ו-`orderBy` על אותו שדה, ולכן אין צורך באינדקס מורכב.
    `firestore.indexes.json` לא משתנה בגלל הפונקציה הזו.
  */
  const codes = await db
    .collection(`branches/${branchId}/accessCodes`)
    .where('validFrom', '<=', now)
    .orderBy('validFrom', 'desc')
    .limit(1)
    .get();

  const code = codes.docs[0]?.data();
  // ⚠️ אין קוד, ואין בשביל מה לקרוא את המשמרות.
  if (!code) return codeAnswerFor([], [], uid, now);

  const { from, to } = monthBounds(code.periodMonth ?? monthKeyNow(now));
  /*
    ⚠️⚠️ ומשמרות החודש של הקוד, ולא של החודש שהלוח מציג. זה ההבדל מהדפדפן,
    שמחזיק רק את החודש שנפתח. DOCS/PLANING/43
  */
  const shifts = await db
    .collection(`branches/${branchId}/shifts`)
    .where('date', '>=', from)
    .where('date', '<=', to)
    .get();

  /*
    ⚠️⚠️ והתשובה אינה נרשמת ביומן, גם לא בהצלחה. הקוד הוא הדבר היחיד
    שהמוצר שומר, ושורת לוג היא עותק שלו במקום שאיש לא ביקש. DOCS/PLANING/29
  */
  return codeAnswerFor(
    shifts.docs.map((entry) => entry.data()),
    [code],
    uid,
    now,
  );
}

// ---------- סגירה ומחיקה של סלון ----------
//
// ⚠️⚠️ DOCS/PLANING/35-there-is-no-way-to-delete-a-salon.md
//
// בהכרעת בעל המוצר 12/10: סגירה הפיכה, ומחיקה "שתתבצע בפועל אחרי 30 יום".
//
// ⚠️ ולמה כאן ולא בדפדפן, ושלוש סיבות:
//
//   1. ⚠️⚠️ התאריך. "בעוד 30 יום" שנכתב מהדפדפן הוא תאריך שאפשר לכתוב
//      אחורה, ואז המחיקה היא עכשיו. כאן השעון הוא של השרת.
//   2. ⚠️⚠️ בקשת המחיקה יושבת ב-`deletionRequests`, ואין לו חוק משלו. כלומר
//      הוא נופל לחוק הסוגר של `firestore.rules`, `allow read, write: if false`,
//      ושום דפדפן אינו יכול לכתוב אליו, גם לא מנהלת. ⚠️ ולכן גם לא נדרש שינוי
//      בחוקים: מה שמכריע אם סלון יימחק נכתב רק מכאן.
//   3. מחיקה של סלון היא מחיקה של אוספי משנה, ודפדפן אינו יכול לעשות אותה.
//      `recursiveDelete` של ה-SDK כן.

/**
 * ⚠️ מפעיל המערכת בלבד. מנהלת סלון אינה סוגרת ואינה מוחקת אותו.
 * אותו מבנה כמו `assertManager`, ומאותן סיבות.
 */
async function assertPlatformAdmin(uid) {
  let snapshot;
  try {
    snapshot = await firestore().doc(`platformAdmins/${uid}`).get();
  } catch (error) {
    logger.error('platform admin lookup failed', {
      uid,
      code: error?.code ?? error?.name ?? 'unknown',
      cause: String(error?.message ?? error),
    });
    throw new HttpsError('internal', 'adminLookupFailed');
  }
  if (!snapshot.exists) {
    logger.warn('not a platform admin', { uid });
    throw new HttpsError('permission-denied', 'notPlatformAdmin');
  }
}

export const manageBranch = onCall(
  { maxInstances: 2, region: 'us-central1' },
  async (request) => {
    try {
      return await handleManage(request);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('unexpected', {
        code: error?.code ?? error?.name ?? 'unknown',
        cause: String(error?.message ?? error),
        stack: error?.stack,
      });
      throw new HttpsError('internal', 'unexpected');
    }
  },
);

async function handleManage(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'noAuth');

  const { branchId, action } = request.data ?? {};
  // ⚠️ מזהה ולא נתיב. `x/members/y` היה מכוון את הכתיבה למסמך אחר.
  if (typeof branchId !== 'string' || !BRANCH_ID.test(branchId)) {
    throw new HttpsError('invalid-argument', 'badBranch');
  }
  if (!ACTIONS.includes(action)) throw new HttpsError('invalid-argument', 'badAction');

  await assertPlatformAdmin(uid);

  const db = firestore();
  const branchRef = db.doc(`branches/${branchId}`);
  const requestRef = db.doc(`deletionRequests/${branchId}`);

  // ⚠️ בטרנזקציה: שתי לחיצות באותו רגע אינן יוצרות שתי בקשות.
  await db.runTransaction(async (tx) => {
    const [branch, pending] = await Promise.all([tx.get(branchRef), tx.get(requestRef)]);
    if (!branch.exists) throw new HttpsError('not-found', 'noBranch');

    const plan = planAction(action, { hasRequest: pending.exists });
    if (plan.error) throw new HttpsError('failed-precondition', plan.error);

    const now = Date.now();
    const update = {};

    if (plan.isActive === false) {
      update.isActive = false;
      // ⚠️ סלון שכבר סגור שומר את מועד הסגירה הראשון.
      if (branch.get('isActive') !== false) {
        update.closedAt = now;
        update.closedBy = uid;
      }
    }
    if (plan.isActive === true) {
      update.isActive = true;
      update.closedAt = FieldValue.delete();
      update.closedBy = FieldValue.delete();
    }

    if (plan.request === 'create') {
      const deleteAfter = Timestamp.fromMillis(deleteAfterFrom(now));
      tx.set(requestRef, {
        branchId,
        requestedBy: uid,
        requestedAt: FieldValue.serverTimestamp(),
        deleteAfter,
      });
      /*
        ⚠️ העתק לתצוגה בלבד, כדי שהרשימה תאמר מתי. מנהלת יכולה לכתוב על
        מסמך הסלון ולשנות אותו, ⚠️ ואין לזה שום השפעה: המחיקה קוראת את
        `deletionRequests`, ולא את השדה הזה.
      */
      update.deletionScheduledFor = deleteAfter;
    }
    if (plan.request === 'delete') {
      tx.delete(requestRef);
      update.deletionScheduledFor = FieldValue.delete();
    }

    if (Object.keys(update).length > 0) tx.update(branchRef, update);
  });

  logger.info('branch managed', { branchId, action, uid });
  return { ok: true };
}

/**
 * ⚠️⚠️ המחיקה עצמה. פעם ביום, בשלוש לפנות בוקר בשעון ישראל.
 *
 * ⚠️ ובלתי הפיכה: הסלון, החברים עם המיילים שלהם, המשמרות, הקודים, ימי
 * הפעילות, והשורות שהמוצר מבטיח שאינן נמחקות. **אין גיבוי במוצר.**
 */
export const deleteDueBranches = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'Asia/Jerusalem',
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
    maxInstances: 1,
  },
  async () => {
    const db = firestore();
    const due = await db
      .collection('deletionRequests')
      .where('deleteAfter', '<=', Timestamp.now())
      .get();

    for (const candidate of due.docs) {
      const branchId = candidate.id;
      try {
        /*
          ⚠️⚠️ ונקראת שוב רגע לפני המחיקה. בין השאילתה לבין המחיקה מישהו יכול
          היה לבטל, ומחיקה של סלון שהמחיקה שלו בוטלה היא בדיוק הטעות שאין
          ממנה דרך חזרה.
        */
        const fresh = await candidate.ref.get();
        if (!fresh.exists || !isDue(fresh.get('deleteAfter')?.toMillis?.(), Date.now())) {
          logger.info('branch deletion skipped', { branchId });
          continue;
        }
        // ⚠️ ובמזהה שעבר את אותה בדיקה כמו בבקשה. מסמך בקשה עם מזהה אחר אינו
        // מכוון את המחיקה לנתיב אחר.
        if (!BRANCH_ID.test(branchId)) {
          logger.error('branch deletion bad id', { branchId });
          continue;
        }

        await db.recursiveDelete(db.doc(`branches/${branchId}`));
        await candidate.ref.delete();
        logger.info('branch deleted', { branchId, requestedBy: fresh.get('requestedBy') });
      } catch (error) {
        // ⚠️ סלון אחד שנכשל אינו עוצר את השאר, וינוסה שוב מחר.
        logger.error('branch deletion failed', {
          branchId,
          code: error?.code ?? error?.name ?? 'unknown',
          cause: String(error?.message ?? error),
        });
      }
    }
  },
);
