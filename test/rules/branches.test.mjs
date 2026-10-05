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
  deleteDoc,
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
    // ⚠️ האוסף נכתב בקונסולה בלבד, ולכן הוא נזרע כאן עם החוקים מנוטרלים.
    await setDoc(doc(db, 'platformAdmins', 'founder'), { note: 'מפעיל המערכת' });
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

  it('⚠️⚠️ ומי שאינו מנהל מערכת אינו פותח סלון בכלל', async () => {
    await seed();
    const db = env.authenticatedContext('nobody').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'branches', 'haifa'), { name: 'חיפה', createdBy: 'nobody' });
    batch.set(doc(db, 'branches', 'haifa', 'members', 'nobody'), {
      uid: 'nobody', displayName: 'מישהו', email: 'n@b.c',
      role: 'manager', status: 'active', joinedAt: 1,
    });
    await assertFails(batch.commit());
  });

  it('⚠️ ואינו קורא את רשומת ההרשאה של מישהו אחר', async () => {
    await seed();
    const db = env.authenticatedContext('nobody').firestore();
    await assertSucceeds(getDoc(doc(db, 'platformAdmins', 'nobody')));
    await assertFails(getDoc(doc(db, 'platformAdmins', 'founder')));
    await assertFails(getDocs(collection(db, 'platformAdmins')));
  });

  it('⚠️ ואינו ממנה את עצמו למנהל מערכת', async () => {
    await seed();
    const db = env.authenticatedContext('nobody').firestore();
    await assertFails(setDoc(doc(db, 'platformAdmins', 'nobody'), { note: 'אני' }));
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

describe('תביעת המערכת', () => {
  /** מצב פתיחה בלי מנהל על ובלי מסמך bootstrap. */
  async function bare() {
    await env.clearFirestore();
  }

  it('הראשון שנכנס תובע את המערכת, באצווה אחת', async () => {
    await bare();
    const db = env.authenticatedContext('first').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'platformAdmins', 'first'), { claimedAt: 1 });
    batch.set(doc(db, 'system', 'bootstrap'), { claimedBy: 'first', claimedAt: 1 });
    await assertSucceeds(batch.commit());
  });

  it('⚠️⚠️ והשני אינו תובע אותה, גם באותה אצווה בדיוק', async () => {
    await bare();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'platformAdmins', 'first'), { claimedAt: 1 });
      await setDoc(doc(db, 'system', 'bootstrap'), { claimedBy: 'first', claimedAt: 1 });
    });
    const db = env.authenticatedContext('second').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'platformAdmins', 'second'), { claimedAt: 2 });
    batch.set(doc(db, 'system', 'bootstrap'), { claimedBy: 'second', claimedAt: 2 });
    await assertFails(batch.commit());
  });

  it('⚠️ ואינו מוחק את הדלת כדי לתבוע שוב', async () => {
    await bare();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'system', 'bootstrap'), { claimedBy: 'first' });
    });
    const db = env.authenticatedContext('second').firestore();
    await assertFails(deleteDoc(doc(db, 'system', 'bootstrap')));
    await assertFails(setDoc(doc(db, 'system', 'bootstrap'), { claimedBy: 'second' }));
  });

  it('⚠️ ותביעה בלי מסמך הדלת נדחית', async () => {
    await bare();
    const db = env.authenticatedContext('first').firestore();
    await assertFails(setDoc(doc(db, 'platformAdmins', 'first'), { claimedAt: 1 }));
  });

  it('⚠️ ואי אפשר לתבוע בשם מישהו אחר', async () => {
    await bare();
    const db = env.authenticatedContext('first').firestore();
    const batch = writeBatch(db);
    batch.set(doc(db, 'platformAdmins', 'someone-else'), { claimedAt: 1 });
    batch.set(doc(db, 'system', 'bootstrap'), { claimedBy: 'first', claimedAt: 1 });
    await assertFails(batch.commit());
  });

  it('מי שתבע פותח סלון, ומי שלא תבע אינו פותח', async () => {
    await bare();
    const db = env.authenticatedContext('first').firestore();
    const claim = writeBatch(db);
    claim.set(doc(db, 'platformAdmins', 'first'), { claimedAt: 1 });
    claim.set(doc(db, 'system', 'bootstrap'), { claimedBy: 'first', claimedAt: 1 });
    await assertSucceeds(claim.commit());

    const open = writeBatch(db);
    open.set(doc(db, 'branches', 'haifa'), { name: 'חיפה', createdBy: 'first' });
    open.set(doc(db, 'branches', 'haifa', 'members', 'first'), {
      uid: 'first', displayName: 'ראשון', email: 'f@b.c',
      role: 'manager', status: 'active', joinedAt: 1,
    });
    await assertSucceeds(open.commit());
  });
});

describe('מנהל המערכת', () => {
  it('מגדיר את המנהלת הראשונה של סלון שנוצר לפני החוק', async () => {
    await seed();
    const db = env.authenticatedContext('founder').firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'branches', 'tel-aviv', 'members', 'tlv-member'), {
        role: 'manager', status: 'active',
      }),
    );
  });

  it('⚠️ ואינו קורא בזכות זה את קוד הכניסה של סלון שאינו חבר בו', async () => {
    await seed();
    const db = env.authenticatedContext('founder').firestore();
    // ההרשאה לפתוח סלון אינה הרשאה לקרוא את מה שבתוך סלון קיים.
    await assertFails(getDoc(doc(db, 'branches', 'tel-aviv', 'accessCodes', '1')));
    await assertFails(getDocs(collection(db, 'branches', 'tel-aviv', 'members')));
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
