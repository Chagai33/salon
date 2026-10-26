// test/rules/members.test.mjs
//
// ⚠️ חוק הרשאות אינו מאומת בקריאה שלו. הוא מאומת בניסיון שאמור להיכשל,
// ובראייה שהוא נכשל. DOCS/PLANING/VERIFICATION-BUDGET.md
//
// הרצה:
//   npx firebase emulators:exec --only firestore --project demo-salon \
//     "node --test --test-concurrency=1 test/rules/*.test.mjs"
//
// ⚠️ `--test-concurrency=1` אינו קישוט: כל הבדיקות חולקות אמולטור אחד.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const BRANCH = 'tel-aviv';

/**
 * ⚠️⚠️ אותה כתובת בדיוק כמו ב-`firestore.rules` וב-`src/utils/operator.ts`.
 * בהכרעת בעל המוצר 26/10/2026: *"זה צריך להיות רק קשיח לכתובת מייל שלי"*.
 * DOCS/PLANING/40-the-system-operator-can-be-demoted.md
 */
const OPERATOR = 'chagai33@gmail.com';

/** ⚠️ חבר עם מייל באסימון. מאז 26/10 החוק דורש שהמייל ברשומה יהיה זה שבאסימון. */
const as = (uid, email) => env.authenticatedContext(uid, email ? { email } : undefined).firestore();

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-salon',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await env?.cleanup();
});

/** מצב פתיחה: סניף קיים, ושני חברים, אחד פעיל ואחת מנהלת. */
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'branches', BRANCH), { name: 'הסלון בתל אביב' });
    await setDoc(doc(db, 'branches', BRANCH, 'members', 'active-one'), {
      uid: 'active-one', displayName: 'פעיל', email: 'a@b.c', role: 'member', status: 'active',
    });
    await setDoc(doc(db, 'branches', BRANCH, 'members', 'manager-one'), {
      uid: 'manager-one', displayName: 'מנהלת', email: 'm@b.c', role: 'manager', status: 'active',
    });
    await setDoc(doc(db, 'branches', BRANCH, 'members', 'pending-one'), {
      uid: 'pending-one', displayName: 'ממתין', email: 'p@b.c', role: 'member', status: 'pending',
    });
    // ⚠️ מפעיל המערכת, כמנהל בסלון הזה. זהו המסמך שאי אפשר להוריד מניהול.
    await setDoc(doc(db, 'branches', BRANCH, 'members', 'operator'), {
      uid: 'operator', displayName: 'מפעיל', email: OPERATOR, role: 'manager', status: 'active',
    });
    await setDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1'), {
      code: '4821', validFrom: 1, periodMonth: '2026-10', setBy: 'manager-one', setAt: 1,
    });
  });
}

describe('רשומת החבר של עצמי', () => {
  it('⚠️ הבאג שנמצא בשטח: אפשר לקרוא את הרשומה של עצמי לפני שהיא קיימת', async () => {
    await seed();
    const db = as('brand-new', 'n@b.c');
    // זו הקריאה ש-ensureMember עושה בכניסה הראשונה. בלעדיה אי אפשר להיכנס
    // לעולם, כי כדי לקרוא צריך להיות חבר, וכדי להיות חבר צריך לקרוא.
    await assertSucceeds(getDoc(doc(db, 'branches', BRANCH, 'members', 'brand-new')));
  });

  it('⚠️ הכניסה הראשונה עובדת, והמייל ברשומה הוא זה שבאסימון', async () => {
    await seed();
    // ⚠️ והבדיקה הזו היא השמירה על רשומה 17. חוק יצירה כבר שבר פעם את
    // הכניסה הראשונה לעולם, ובדיקת המייל שנוספה 26/10 נוגעת בדיוק בה.
    const db = as('brand-new', 'n@b.c');
    await assertSucceeds(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'brand-new'), {
        uid: 'brand-new', displayName: 'חדש', email: 'n@b.c', role: 'member', status: 'pending',
        joinedAt: 1,
      }),
    );
  });

  it('אי אפשר ליצור את עצמי כמנהלת', async () => {
    await seed();
    // ⚠️ המייל תואם לאסימון בכוונה, אחרת הבדיקה נעצרת על המייל ואינה מגיעה
    // לטענה שלה, שהיא התפקיד. DOCS/PLANING/32
    const db = as('sneaky', 's@b.c');
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'sneaky'), {
        uid: 'sneaky', displayName: 'ערמומי', email: 's@b.c', role: 'manager', status: 'active',
        joinedAt: 1,
      }),
    );
  });

  it('אי אפשר ליצור את עצמי כפעיל, בלי אישור מנהלת', async () => {
    await seed();
    const db = as('sneaky', 's@b.c');
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'sneaky'), {
        uid: 'sneaky', displayName: 'ערמומי', email: 's@b.c', role: 'member', status: 'active',
        joinedAt: 1,
      }),
    );
  });

  it('אי אפשר ליצור רשומה בשם מישהו אחר', async () => {
    await seed();
    // ⚠️ והמייל הוא שלו, כדי שמה שנמדד יהיה המזהה ולא המייל.
    const db = as('sneaky', 's@b.c');
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'someone-else'), {
        uid: 'someone-else', displayName: 'אחר', email: 's@b.c', role: 'member', status: 'pending',
        joinedAt: 1,
      }),
    );
  });

  it('⚠️⚠️ ואי אפשר להירשם עם המייל של מפעיל המערכת', async () => {
    await seed();
    /*
      בלי הבדיקה הזו הזיהוי הקשיח ריק מתוכן: כל נרשם כותב לעצמו את הכתובת
      של מפעיל המערכת, ומנהלת שתקדם אותו בטעות לא תוכל להוריד אותו לעולם.
      DOCS/PLANING/40-the-system-operator-can-be-demoted.md
    */
    const db = as('impostor', 'impostor@b.c');
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'impostor'), {
        uid: 'impostor', displayName: 'מתחזה', email: OPERATOR, role: 'member', status: 'pending',
        joinedAt: 1,
      }),
    );
  });

  it('וגם לא עם המייל של חבר אחר', async () => {
    await seed();
    const db = as('impostor', 'impostor@b.c');
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'impostor'), {
        uid: 'impostor', displayName: 'מתחזה', email: 'm@b.c', role: 'member', status: 'pending',
        joinedAt: 1,
      }),
    );
  });

  it('⚠️ ומי שנכנס בלי מייל באסימון אינו נרשם עם מייל', async () => {
    await seed();
    // ⚠️ הכניסה היא Google בלבד, ולכן זה אינו אמור לקרות. אם יקרה, הכיוון
    // הבטוח הוא דחייה ולא רשומה עם כתובת שאיש לא הוכיח.
    const db = env.authenticatedContext('no-email').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'no-email'), {
        uid: 'no-email', displayName: 'בלי מייל', email: 'x@b.c', role: 'member',
        status: 'pending', joinedAt: 1,
      }),
    );
  });

  it('חבר אינו מאשר את עצמו', async () => {
    await seed();
    const db = env.authenticatedContext('pending-one').firestore();
    await assertFails(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'pending-one'), { status: 'active' }),
    );
  });

  it('⚠️ מנהלת מגדירה חבר אחר כמנהל, ואז יש שניים בסניף', async () => {
    await seed();
    const db = env.authenticatedContext('manager-one').firestore();
    // בעל המוצר שאל אם אפשר יותר ממנהל אחד לסניף. זו התשובה, במדידה.
    await assertSucceeds(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'active-one'), { role: 'manager' }),
    );
  });

  it('⚠️ ומנהל המערכת מאציל גם הוא, בסניף שאינו חבר בו', async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'platformAdmins', 'root'), { note: 'מפעיל' });
    });
    const db = env.authenticatedContext('root').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'active-one'), {
        role: 'manager', status: 'active',
      }),
    );
  });

  it('⚠️ וחבר פעיל אינו מגדיר מנהל', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertFails(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'pending-one'), { role: 'manager' }),
    );
  });

  it('מנהלת מאשרת חבר', async () => {
    await seed();
    const db = env.authenticatedContext('manager-one').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'pending-one'), { status: 'active' }),
    );
  });
});

describe('סריקת החברים', () => {
  it('⚠️ חבר פעיל אינו סורק את הרשימה, בהכרעת בעל המוצר 06/10', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    // הרשומה מחזיקה מייל, ולכן סריקה היא קריאת המיילים של כולם.
    await assertFails(getDocs(collection(db, 'branches', BRANCH, 'members')));
  });

  it('מנהלת סורקת את הרשימה', async () => {
    await seed();
    const db = env.authenticatedContext('manager-one').firestore();
    await assertSucceeds(getDocs(collection(db, 'branches', BRANCH, 'members')));
  });

  it('וחבר כן קורא את הרשומה של עצמו', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertSucceeds(getDoc(doc(db, 'branches', BRANCH, 'members', 'active-one')));
  });

  it('מי שאינו חבר אינו סורק את הרשימה', async () => {
    await seed();
    const db = env.authenticatedContext('stranger').firestore();
    await assertFails(getDocs(collection(db, 'branches', BRANCH, 'members')));
  });

  it('מי שאינו מחובר אינו קורא כלום', async () => {
    await seed();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'branches', BRANCH, 'members', 'active-one')));
  });
});

describe('קוד הכניסה', () => {
  it('⚠️⚠️ חבר פעיל אינו קורא את הקוד מהמסד עוד, וזה הסבב כולו', async () => {
    await seed();
    /*
      עד 26/10/2026 הקריאה הזו עברה, וזה היה הפער החמור ביותר במוצר: הסינון
      ישב בממשק, וכל חבר פעיל קרא את הקוד בכלי פיתוח בלי להיות משובץ.
      ⚠️ ועכשיו הוא מקבל אותו מפונקציית הענן, שמחשבת זכאות בצד השרת.
      DOCS/PLANING/15-the-code-is-not-enforced-yet.md
    */
    const db = as('active-one', 'a@b.c');
    await assertFails(getDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1')));
  });

  it('⚠️ וגם לא בסריקה של האוסף, ולא רק במסמך', async () => {
    await seed();
    // ⚠️ מסמך בודד ואוסף הם שתי הרשאות, ומי שחוסם אחת ושוכח את השנייה לא
    // חסם כלום. DOCS/PLANING/22
    const db = as('active-one', 'a@b.c');
    await assertFails(getDocs(collection(db, 'branches', BRANCH, 'accessCodes')));
  });

  it('מנהלת קוראת את הקוד, כי היא זו שמגדירה אותו', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertSucceeds(getDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1')));
  });

  it('מי שממתין לאישור אינו קורא את הקוד', async () => {
    await seed();
    const db = as('pending-one', 'p@b.c');
    await assertFails(getDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1')));
  });

  it('זר אינו קורא את הקוד', async () => {
    await seed();
    const db = as('stranger', 'z@b.c');
    await assertFails(getDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1')));
  });

  it('חבר אינו כותב קוד', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'accessCodes', '2'), { code: '0000' }),
    );
  });

  it('מנהלת כותבת קוד', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertSucceeds(
      setDoc(doc(db, 'branches', BRANCH, 'accessCodes', '2'), {
        code: '0000', validFrom: 2, periodMonth: '2026-10', setBy: 'manager-one', setAt: 2,
      }),
    );
  });
});

/**
 * ⚠️⚠️ אזור ליבה: הרשאות.
 *
 * בקשת בעל המוצר, 26/10/2026: *"לא לאפשר להסיר את מנהל המערכת
 * chagai33@gmail.com בשום צורה"*, ובהכרעתו האכיפה היא בחוקי המסד.
 * DOCS/PLANING/40-the-system-operator-can-be-demoted.md
 */
describe('מפעיל המערכת', () => {
  it('⚠️⚠️ מנהלת אינה מורידה את מפעיל המערכת מניהול', async () => {
    await seed();
    // עד 26/10/2026 הכתיבה הזו עברה, ואז מי שאחראי על כל המוצר לא יכול היה
    // לנהל סלון בתוכו.
    const db = as('manager-one', 'm@b.c');
    await assertFails(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'operator'), { role: 'member' }),
    );
  });

  it('⚠️ ואינה משביתה אותו, וזו אותה הסרה בדרך אחרת', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertFails(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'operator'), { status: 'inactive' }),
    );
  });

  it('⚠️⚠️ ואינה משנה את המייל שלו, אחרת ההגנה נעקפת בשתי כתיבות', async () => {
    await seed();
    // קודם משנים את הכתובת, ואז הרשומה כבר אינה של מפעיל המערכת.
    const db = as('manager-one', 'm@b.c');
    await assertFails(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'operator'), { email: 'other@b.c' }),
    );
  });

  it('⚠️ וגם מפעיל המערכת עצמו אינו מוריד את עצמו', async () => {
    await seed();
    const db = as('operator', OPERATOR);
    await assertFails(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'operator'), { role: 'member' }),
    );
  });

  it('⚠️ וגם לא דרך הרשאת מנהל המערכת שעוקפת חברות בסניף', async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'platformAdmins', 'root'), { note: 'מפעיל' });
    });
    const db = as('root', 'root@b.c');
    await assertFails(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'operator'), { role: 'member' }),
    );
  });

  it('ורשומת החבר שלו אינה נמחקת', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertFails(deleteDoc(doc(db, 'branches', BRANCH, 'members', 'operator')));
  });

  it('⚠️ ומה שכן מותר: לקדם אותו, ולעדכן את מה שאינו תפקיד או מצב', async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (context) => {
      // מפעיל המערכת כחבר רגיל בסלון, וזה המצב שממנו צריך לקדם.
      await setDoc(doc(context.firestore(), 'branches', BRANCH, 'members', 'operator'), {
        uid: 'operator', displayName: 'מפעיל', email: OPERATOR, role: 'member', status: 'pending',
      });
    });
    const db = as('manager-one', 'm@b.c');
    await assertSucceeds(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'operator'), {
        role: 'manager', status: 'active',
      }),
    );
  });

  it('⚠️ וחבר רגיל כן יורד מניהול. החסימה היא עליו ולא על כולם', async () => {
    await seed();
    // בלי הבדיקה הזו "אי אפשר להוריד" יכול להיות נכון מהסיבה הלא נכונה.
    const db = as('manager-one', 'm@b.c');
    await assertSucceeds(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'active-one'), { role: 'manager' }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'branches', BRANCH, 'members', 'active-one'), { role: 'member' }),
    );
  });
});
