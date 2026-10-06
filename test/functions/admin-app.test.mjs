// test/functions/admin-app.test.mjs
//
// ⚠️⚠️ הבדיקה הזו קיימת בגלל כשל שהגיע עד בעל המוצר.
//
// הייבוא החזיר 500 בכל קריאה, והמסך אמר "המודל לא הצליח לקרוא את התמונה".
// המודל לא נקרא בכלל. ביומן:
//
//     FirebaseAppError: The default Firebase app does not exist.
//     code: 'app/no-app'   at getFirestore   at firestore (index.mjs:43)
//
// הסיבה אינה ההרשאות ואינה המפתח: `firebase-functions` רושם אפליקציית admin
// בשם משלו כדי לאמת את האסימון של הקורא, לפני שהקוד שלנו רץ. ולכן
// `getApps()` אינו ריק, ולכן האתחול שלנו דילג, ולכן אין ברירת מחדל.
//
// ⚠️ ולכן הבדיקה פותחת ברישום אפליקציה בשם, בדיוק כמו ה-SDK. בלי השורה
// הזו היא עוברת גם על הקוד השבור, ואינה שווה כלום.
//
// הרצה: node --test test/functions/*.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { firestore } from '../../functions/admin-app.mjs';
// ⚠️ וגם הקובץ שנפרס, כדי שהבדיקה למטה תוכיח שטעינתו אינה מאתחלת כלום.
import { readBoardImage } from '../../functions/index.mjs';

/*
  ⚠️ `firebase-admin` יושב ב-functions/node_modules ולא בשורש, ולכן ייבוא
  רגיל מכאן אינו נפתר. `createRequire` מבסיס בתוך functions פותר אותו משם.

  ⚠️ ושתי הדרכים מגיעות לאותו מודול: ה-ESM של firebase-admin הוא עטיפה דקה
  מעל ה-CJS, ולכן מרשם האפליקציות משותף. הבדיקה למטה שומרת על זה: אם זה
  יפסיק להיות נכון, `getApp()` יזרוק והבדיקה תיפול.
*/
const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const { applicationDefault, getApp, getApps, initializeApp } = requireFromFunctions('firebase-admin/app');
const { getFirestore } = requireFromFunctions('firebase-admin/firestore');

const SDK_APP_NAME = '__FIREBASE_FUNCTIONS_SDK__';

describe('החיבור למסד', () => {
  /*
    ⚠️⚠️ והבדיקה הזו ראשונה כי היא מתארת את הרגע שלפני הכול, וכל בדיקה
    אחרת כאן מלכלכת אותו.

    הסיפור: `initializeApp()` בראש המודול הפיל את הפריסה ב-"Cannot determine
    backend specification. Timeout after 10000", כי ה-CLI טוען את הקובץ כדי
    לגלות מה יש בו. התיקון לזה הוא ששום דבר אינו רץ בטעינה, והתיקון ההוא הוא
    שהוליד את הבאג של app/no-app. שני הצדדים נשמרים כאן, ולא אחד.
  */
  it('⚠️ טעינת הקובץ שנפרס אינה מאתחלת אפליקציה, וזו הפריסה', () => {
    assert.deepEqual(getApps(), []);
    // והפונקציה עצמה כן הוצהרה.
    assert.equal(typeof readBoardImage, 'function');
  });

  it('⚠️ נפתח גם כשה-SDK כבר רשם אפליקציה בשם, וזה הכשל שהיה', () => {
    // זה מה שאימות האסימון של הקורא עושה, לפני כל שורה שלנו.
    // functions/node_modules/firebase-functions/lib/common/app.js
    initializeApp(
      { projectId: 'demo-salon', credential: applicationDefault() },
      SDK_APP_NAME,
    );
    assert.deepEqual(getApps().map((app) => app.name), [SDK_APP_NAME]);

    // הקוד שנפרס זרק כאן app/no-app.
    assert.equal(firestore().constructor.name, 'Firestore');

    // ואפליקציית ברירת המחדל קיימת עכשיו, כלומר נרשמה ולא הושאלה מה-SDK.
    assert.equal(getApp().name, '[DEFAULT]');
  });

  it('אותו חיבור חוזר בקריאה שנייה, ואינו נפתח מחדש', () => {
    assert.equal(firestore(), firestore());
    // ⚠️ ושתי אפליקציות בלבד. אתחול חוזר היה נופל ב-app/duplicate-app.
    assert.equal(getApps().length, 2);
  });

  it('ומכאן גם getFirestore בלי ארגומנט עובד, כי יש ברירת מחדל', () => {
    assert.equal(getFirestore().constructor.name, 'Firestore');
  });
});
