// functions/admin-app.mjs
//
// ⚠️⚠️ החיבור למסד, ולמה הוא קובץ בפני עצמו.
//
// הקוד שנפרס החזיק את השורות האלה:
//
//     if (getApps().length === 0) initializeApp();
//     return getFirestore();
//
// והוא נפל בכל קריאה, ב-500:
//
//     FirebaseAppError: The default Firebase app does not exist.
//     code: 'app/no-app'   at getFirestore   at firestore (index.mjs:43)
//
// למה: `firebase-functions` מאמת את האסימון של הקורא לפני שהקוד שלנו רץ,
// ולצורך זה הוא רושם אפליקציית admin בשם משלו, `__FIREBASE_FUNCTIONS_SDK__`.
// node_modules/firebase-functions/lib/common/app.js
//
// כלומר `getApps()` אינו ריק, הבדיקה דילגה על האתחול, ואז `getFirestore()`
// בלי ארגומנט חיפש את אפליקציית ברירת המחדל, שאף אחד לא רשם.
//
// ⚠️ ולכן `getApp()` ולא `getApps().length`. השאלה אינה "יש אפליקציה" אלא
// "יש אפליקציית ברירת מחדל", ואת זו רק `getApp()` עונה.
//
// ⚠️ וההפרדה לקובץ אינה סדר: `index.mjs` מצהיר טריגרים ואי אפשר לייבא אותו
// בבדיקה בלי לטעון אותם. כאן אפשר, ויש בדיקה. test/functions/admin-app.test.mjs

import { getApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;

/**
 * מחזירה חיבור למסד, ורושמת את אפליקציית ברירת המחדל אם היא עוד לא נרשמה.
 *
 * ⚠️ והאתחול כאן ולא בראש המודול. `initializeApp()` בזמן טעינת המודול הפיל
 * את הפריסה ב-"Cannot determine backend specification. Timeout after 10000",
 * כי ה-CLI טוען את המודול כדי לגלות מה יש בו, ובמכונה בלי הרשאות ענן
 * האתחול מחפש אותן ונתקע.
 * https://firebase.google.com/docs/functions/tips#avoid_deployment_timeouts_during_initialization
 */
export function firestore() {
  if (!db) db = getFirestore(defaultApp());
  return db;
}

function defaultApp() {
  try {
    return getApp();
  } catch {
    // ⚠️ `getApp()` זורק `app/no-app` כשאין ברירת מחדל, וזו הדרך לשאול.
    return initializeApp();
  }
}
