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
import { doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const BRANCH = 'tel-aviv';
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
    await setDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1'), {
      code: '4821', validFrom: 1, periodMonth: '2026-10', setBy: 'manager-one', setAt: 1,
    });
  });
}

describe('רשומת החבר של עצמי', () => {
  it('⚠️ הבאג שנמצא בשטח: אפשר לקרוא את הרשומה של עצמי לפני שהיא קיימת', async () => {
    await seed();
    const db = env.authenticatedContext('brand-new').firestore();
    // זו הקריאה ש-ensureMember עושה בכניסה הראשונה. בלעדיה אי אפשר להיכנס
    // לעולם, כי כדי לקרוא צריך להיות חבר, וכדי להיות חבר צריך לקרוא.
    await assertSucceeds(getDoc(doc(db, 'branches', BRANCH, 'members', 'brand-new')));
  });

  it('אפשר ליצור את הרשומה של עצמי, כ-pending ו-member', async () => {
    await seed();
    const db = env.authenticatedContext('brand-new').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'brand-new'), {
        uid: 'brand-new', displayName: 'חדש', email: 'n@b.c', role: 'member', status: 'pending',
        joinedAt: 1,
      }),
    );
  });

  it('אי אפשר ליצור את עצמי כמנהלת', async () => {
    await seed();
    const db = env.authenticatedContext('sneaky').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'sneaky'), {
        uid: 'sneaky', displayName: 'ערמומי', email: 's@b.c', role: 'manager', status: 'active',
        joinedAt: 1,
      }),
    );
  });

  it('אי אפשר ליצור את עצמי כפעיל, בלי אישור מנהלת', async () => {
    await seed();
    const db = env.authenticatedContext('sneaky').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'sneaky'), {
        uid: 'sneaky', displayName: 'ערמומי', email: 's@b.c', role: 'member', status: 'active',
        joinedAt: 1,
      }),
    );
  });

  it('אי אפשר ליצור רשומה בשם מישהו אחר', async () => {
    await seed();
    const db = env.authenticatedContext('sneaky').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'members', 'someone-else'), {
        uid: 'someone-else', displayName: 'אחר', email: 'o@b.c', role: 'member', status: 'pending',
        joinedAt: 1,
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
  it('חבר פעיל קורא את הקוד', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertSucceeds(getDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1')));
  });

  it('⚠️ וזה בדיוק הפער שברשומה 15: גם מי שלא השתבץ החודש קורא אותו', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    // active-one אינו משובץ לשום משמרת, והקריאה בכל זאת עוברת.
    const snapshot = await getDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1'));
    assert.equal(snapshot.data().code, '4821');
  });

  it('מי שממתין לאישור אינו קורא את הקוד', async () => {
    await seed();
    const db = env.authenticatedContext('pending-one').firestore();
    await assertFails(getDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1')));
  });

  it('זר אינו קורא את הקוד', async () => {
    await seed();
    const db = env.authenticatedContext('stranger').firestore();
    await assertFails(getDoc(doc(db, 'branches', BRANCH, 'accessCodes', '1')));
  });

  it('חבר אינו כותב קוד', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'accessCodes', '2'), { code: '0000' }),
    );
  });

  it('מנהלת כותבת קוד', async () => {
    await seed();
    const db = env.authenticatedContext('manager-one').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'branches', BRANCH, 'accessCodes', '2'), {
        code: '0000', validFrom: 2, periodMonth: '2026-10', setBy: 'manager-one', setAt: 2,
      }),
    );
  });
});
