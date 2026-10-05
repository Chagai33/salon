// test/rules/branches.test.mjs
//
// פתיחת סלון כטננט, והגבול בין טננטים.
//
// ⚠️ "כל סלון עם המידע שלו" אינו נכון כי המודל מקונן. הוא נכון רק אם קריאה
// מעבר לגבול נדחית בפועל, וזה מה שנמדד כאן.
// DOCS/PLANING/18-each-salon-is-a-tenant.md

import { after, before, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-salon-branches',
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

/** שני סלונים קיימים, ולכל אחד חבר משלו. */
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [branchId, memberId] of [
      ['tel-aviv', 'tlv-member'],
      ['jerusalem', 'jlm-member'],
    ]) {
      await setDoc(doc(db, 'branches', branchId), {
        name: branchId,
        createdBy: `${memberId}-founder`,
      });
      await setDoc(doc(db, 'branches', branchId, 'members', memberId), {
        uid: memberId, displayName: memberId, email: `${memberId}@b.c`,
        role: 'manager', status: 'active',
      });
      await setDoc(doc(db, 'branches', branchId, 'shifts', '2026-10-08_morning'), {
        date: '2026-10-08', attendance: 'assumed', handoverState: 'none',
      });
      await setDoc(doc(db, 'branches', branchId, 'accessCodes', '1'), {
        code: `${branchId}-code`, periodMonth: '2026-10', validFrom: 1,
      });
    }
  });
}

describe('פתיחת סלון', () => {
  it('מי שפותח סלון חדש נכתב כמנהל שלו, באותה אצווה', async () => {
    await seed();
    const db = env.authenticatedContext('founder').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'branches', 'haifa'), { name: 'הסלון בחיפה', createdBy: 'founder' });
    batch.set(doc(db, 'branches', 'haifa', 'members', 'founder'), {
      uid: 'founder', displayName: 'פותח', email: 'f@b.c',
      role: 'manager', status: 'active', joinedAt: 1,
    });
    await assertSucceeds(batch.commit());
  });

  it('⚠️ סלון בלי מנהל באותה אצווה אינו נפתח', async () => {
    await seed();
    const db = env.authenticatedContext('founder').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', 'haifa'), { name: 'הסלון בחיפה', createdBy: 'founder' }),
    );
  });

  it('⚠️ אי אפשר לפתוח סלון בשם מישהו אחר', async () => {
    await seed();
    const db = env.authenticatedContext('founder').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'branches', 'haifa'), { name: 'חיפה', createdBy: 'someone-else' });
    batch.set(doc(db, 'branches', 'haifa', 'members', 'founder'), {
      uid: 'founder', displayName: 'פותח', email: 'f@b.c',
      role: 'manager', status: 'active', joinedAt: 1,
    });
    await assertFails(batch.commit());
  });

  it('⚠️⚠️ והחור שהחוק הזה סוגר: אי אפשר למנות את עצמי למנהל בסלון קיים', async () => {
    await seed();
    const db = env.authenticatedContext('intruder').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', 'tel-aviv', 'members', 'intruder'), {
        uid: 'intruder', displayName: 'פולש', email: 'i@b.c',
        role: 'manager', status: 'active', joinedAt: 1,
      }),
    );
  });

  it('ואותו ניסיון גם כאצווה שמנסה לדרוס את מסמך הסלון', async () => {
    await seed();
    const db = env.authenticatedContext('intruder').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'branches', 'tel-aviv'), { name: 'שלי עכשיו', createdBy: 'intruder' });
    batch.set(doc(db, 'branches', 'tel-aviv', 'members', 'intruder'), {
      uid: 'intruder', displayName: 'פולש', email: 'i@b.c',
      role: 'manager', status: 'active', joinedAt: 1,
    });
    await assertFails(batch.commit());
  });

  it('הצטרפות לסלון קיים נשארת pending', async () => {
    await seed();
    const db = env.authenticatedContext('newcomer').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'branches', 'tel-aviv', 'members', 'newcomer'), {
        uid: 'newcomer', displayName: 'חדש', email: 'n@b.c',
        role: 'member', status: 'pending', joinedAt: 1,
      }),
    );
  });
});

describe('הגבול בין סלונים', () => {
  it('כל מי שמחובר קורא את רשימת הסלונים', async () => {
    await seed();
    const db = env.authenticatedContext('newcomer').firestore();
    await assertSucceeds(getDocs(collection(db, 'branches')));
  });

  it('⚠️ וחבר של סלון אחד אינו קורא את החברים של האחר', async () => {
    await seed();
    const db = env.authenticatedContext('tlv-member').firestore();
    await assertSucceeds(getDocs(collection(db, 'branches', 'tel-aviv', 'members')));
    await assertFails(getDocs(collection(db, 'branches', 'jerusalem', 'members')));
  });

  it('⚠️ ואינו קורא את המשמרות של האחר', async () => {
    await seed();
    const db = env.authenticatedContext('tlv-member').firestore();
    await assertFails(getDocs(collection(db, 'branches', 'jerusalem', 'shifts')));
  });

  it('⚠️⚠️ ואינו קורא את קוד הכניסה של האחר', async () => {
    await seed();
    const db = env.authenticatedContext('tlv-member').firestore();
    await assertSucceeds(getDoc(doc(db, 'branches', 'tel-aviv', 'accessCodes', '1')));
    await assertFails(getDoc(doc(db, 'branches', 'jerusalem', 'accessCodes', '1')));
  });

  it('⚠️ ומנהל של סלון אחד אינו עורך את ההגדרות של האחר', async () => {
    await seed();
    const db = env.authenticatedContext('tlv-member').firestore();
    await assertSucceeds(updateDoc(doc(db, 'branches', 'tel-aviv'), { name: 'שם חדש' }));
    await assertFails(updateDoc(doc(db, 'branches', 'jerusalem'), { name: 'שם חדש' }));
  });

  it('⚠️ ואינו מאשר חבר בסלון האחר', async () => {
    await seed();
    const db = env.authenticatedContext('tlv-member').firestore();
    await assertFails(
      updateDoc(doc(db, 'branches', 'jerusalem', 'members', 'jlm-member'), { status: 'inactive' }),
    );
  });
});
