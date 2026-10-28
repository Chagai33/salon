// test/rules/events.test.mjs
//
// ⚠️⚠️ אזור ליבה. הרשומה שנכתבת ואינה נמחקת, שאומרת מי עשה מה ומתי.
// DOCS/PLANING/29-nothing-records-that-someone-cancelled.md
//
// ⚠️ חוק הרשאות אינו מאומת בקריאה שלו. הוא מאומת בניסיון שאמור להיכשל,
// ובראייה שהוא נכשל. DOCS/PLANING/VERIFICATION-BUDGET.md
//
// הרצה:
//   npm run test:rules
//
// ⚠️ `--test-concurrency=1` אינו קישוט: כל הבדיקות חולקות אמולטור אחד.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const BRANCH = 'tel-aviv';
const OTHER = 'jerusalem';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-salon-events',
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

/** שורה תקנית, כפי שהאפליקציה כותבת אותה. */
function row(actorMemberId, extra = {}) {
  return {
    at: 1760000000000,
    expiresAt: Timestamp.fromMillis(1760000000000),
    actorMemberId,
    action: 'shiftReleased',
    shiftId: '2026-10-14_morning',
    shiftDate: '2026-10-14',
    subjectMemberId: actorMemberId,
    ...extra,
  };
}

/** שני סלונים, ובתל אביב חבר פעיל, מנהלת, וממתין לאישור. */
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'platformAdmins', 'root'), { note: 'מפעיל המערכת' });
    for (const branchId of [BRANCH, OTHER]) {
      await setDoc(doc(db, 'branches', branchId), { name: branchId });
      await setDoc(doc(db, 'branches', branchId, 'members', 'active-one'), {
        uid: 'active-one', displayName: 'פעיל', email: 'a@b.c',
        role: 'member', status: 'active',
      });
      await setDoc(doc(db, 'branches', branchId, 'members', 'manager-one'), {
        uid: 'manager-one', displayName: 'מנהלת', email: 'm@b.c',
        role: 'manager', status: 'active',
      });
      await setDoc(doc(db, 'branches', branchId, 'members', 'pending-one'), {
        uid: 'pending-one', displayName: 'ממתין', email: 'p@b.c',
        role: 'member', status: 'pending',
      });
      // שורה שכבר קיימת, כדי שיהיה מה לנסות לקרוא, לעדכן ולמחוק.
      await setDoc(doc(db, 'branches', branchId, 'events', 'existing'), row('active-one'));
    }
    // ⚠️ ובתל אביב בלבד: מנהל המערכת רשום כחבר שממתין לאישור. זה המצב בסלון
    // שנוצר לפני שהוא תבע את המערכת, והוא עדיין מאציל תפקידים בו.
    await setDoc(doc(context.firestore(), 'branches', BRANCH, 'members', 'root'), {
      uid: 'root', displayName: 'מפעיל', email: 'r@b.c',
      role: 'member', status: 'pending',
    });
  });
}

describe('מי כותב שורה', () => {
  it('חבר פעיל כותב שורה בשם עצמו', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'branches', BRANCH, 'events', 'new-one'), row('active-one')),
    );
  });

  it('⚠️ ואינו כותב שורה בשם אדם אחר', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    // בלי זה אפשר לכתוב "פלוני ביטל" על מי שלא ביטל.
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'events', 'forged'), row('manager-one')),
    );
  });

  it('מי שממתין לאישור אינו כותב', async () => {
    await seed();
    const db = env.authenticatedContext('pending-one').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'events', 'nope'), row('pending-one')),
    );
  });

  it('זר אינו כותב', async () => {
    await seed();
    const db = env.authenticatedContext('stranger').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'events', 'nope'), row('stranger')),
    );
  });

  it('מי שאינו מחובר אינו כותב', async () => {
    await seed();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'events', 'nope'), row('nobody')),
    );
  });

  it('⚠️ ומנהל המערכת כותב גם כשהוא אינו חבר פעיל בסלון', async () => {
    await seed();
    // זה המצב שבו הוא מאציל תפקיד בסלון שנוצר לפניו. בלי התוספת הזו ההאצלה
    // שלו נדחית כולה, כי השורה נכתבת באותה אצווה.
    const db = env.authenticatedContext('root').firestore();
    await assertSucceeds(
      setDoc(
        doc(db, 'branches', BRANCH, 'events', 'by-root'),
        row('root', { action: 'roleChanged', detail: 'manager', subjectMemberId: 'active-one' }),
      ),
    );
  });
});

describe('⚠️⚠️ אין עדכון ואין מחיקה, גם למנהלת', () => {
  it('מנהלת אינה מוחקת שורה', async () => {
    await seed();
    // שורה שמי שנמצא בה יכול למחוק ממנה אינה ראיה, והמנהלת היא בדיוק מי
    // שהשורה מתעדת כשהיא מחליפה קוד או משנה הרשאות.
    const db = env.authenticatedContext('manager-one').firestore();
    await assertFails(deleteDoc(doc(db, 'branches', BRANCH, 'events', 'existing')));
  });

  it('מנהלת אינה מעדכנת שורה', async () => {
    await seed();
    const db = env.authenticatedContext('manager-one').firestore();
    await assertFails(
      updateDoc(doc(db, 'branches', BRANCH, 'events', 'existing'), { action: 'shiftAssigned' }),
    );
  });

  it('חבר אינו מוחק את השורה של עצמו', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertFails(deleteDoc(doc(db, 'branches', BRANCH, 'events', 'existing')));
  });

  it('⚠️ ואינו דורס אותה בכתיבה שנייה לאותו מזהה', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    // `setDoc` על מסמך קיים הוא update בעיני החוקים, ולכן הוא נדחה.
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'events', 'existing'), row('active-one')),
    );
  });
});

describe('⚠️⚠️ סכמה סגורה, ובלי טקסט חופשי', () => {
  it('שדה שאינו בסכמה נדחה', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    // זה הכלל שמונע מהשורה להיות מצבור מידע אישי.
    await assertFails(
      setDoc(
        doc(db, 'branches', BRANCH, 'events', 'with-note'),
        row('active-one', { note: 'הוא לא אמין' }),
      ),
    );
  });

  it('⚠️ פעולה שאינה ברשימה נדחית, ולכן אי אפשר לכתוב משפט לתוכה', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertFails(
      setDoc(
        doc(db, 'branches', BRANCH, 'events', 'free-text'),
        row('active-one', { action: 'ביטל שלוש פעמים והוא לא אמין' }),
      ),
    );
  });

  it('פירוט שאינו ברשימה נדחה', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertFails(
      setDoc(
        doc(db, 'branches', BRANCH, 'events', 'bad-detail'),
        row('active-one', { action: 'attendanceSet', detail: 'מה שבא לי' }),
      ),
    );
  });

  it('פירוט שכן ברשימה עובר', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertSucceeds(
      setDoc(
        doc(db, 'branches', BRANCH, 'events', 'good-detail'),
        row('active-one', { action: 'attendanceSet', detail: 'noShow' }),
      ),
    );
  });

  it('⚠️ ושורת ההשבתה עוברת, כי היא השורה היחידה שמתעדת את ההכרעה', async () => {
    await seed();
    /*
      המנהלת משביתה משמרת, ו-`setShiftCancelled` כותבת אותה כ-`attendanceSet`
      עם `detail: 'cancelled'`. ⚠️ ואם השורה נדחית, כל האצווה נדחית והמשמרת
      אינה מושבתת בכלל. DOCS/PLANING/59
    */
    const db = env.authenticatedContext('manager-one').firestore();
    await assertSucceeds(
      setDoc(
        doc(db, 'branches', BRANCH, 'events', 'off-row'),
        row('manager-one', { action: 'attendanceSet', detail: 'cancelled' }),
      ),
    );
  });

  it('⚠️⚠️ שדה התפוגה חייב להיות חותמת זמן, ולא מספר', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    // מדיניות התפוגה של Firestore מוחקת לפי חותמת זמן. שדה מספרי אינו נמחק
    // כלל, ולכן שורה כזו הייתה נשמרת לנצח. DOCS/PLANING/29
    await assertFails(
      setDoc(
        doc(db, 'branches', BRANCH, 'events', 'number-expiry'),
        row('active-one', { expiresAt: 1760000000000 }),
      ),
    );
  });

  it('שורה בלי שדה תפוגה נדחית', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    const { expiresAt, ...withoutExpiry } = row('active-one');
    assert.ok(expiresAt);
    await assertFails(
      setDoc(doc(db, 'branches', BRANCH, 'events', 'no-expiry'), withoutExpiry),
    );
  });
});

describe('מי קורא', () => {
  it('מנהלת סורקת את כל השורות', async () => {
    await seed();
    const db = env.authenticatedContext('manager-one').firestore();
    await assertSucceeds(getDocs(collection(db, 'branches', BRANCH, 'events')));
  });

  it('חבר פעיל אינו סורק', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertFails(getDocs(collection(db, 'branches', BRANCH, 'events')));
  });

  it('⚠️⚠️ וגם לא כשהוא מסנן את השאילתה לעצמו', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    /*
      זה הממצא, במדידה: חוקי Firestore אינם בודקים את תנאי השאילתה, ולכן
      `allow list: if isManager` דוחה גם שאילתה שהחבר מסנן לשורות של עצמו.
      כלומר חבר אינו יכול לראות את מה שנרשם עליו, וזה סותר את כלל הפרטיות
      השלישי ברשומה 29. ההבטחה נאמרת במילים במסך הפרטיות.
      DOCS/PLANING/30-a-member-cannot-read-their-own-record.md
    */
    await assertFails(
      getDocs(
        query(
          collection(db, 'branches', BRANCH, 'events'),
          where('actorMemberId', '==', 'active-one'),
        ),
      ),
    );
  });

  it('חבר קורא שורה בודדת שהוא עשה', async () => {
    await seed();
    const db = env.authenticatedContext('active-one').firestore();
    await assertSucceeds(getDoc(doc(db, 'branches', BRANCH, 'events', 'existing')));
  });

  it('⚠️ ואינו קורא שורה של אדם אחר', async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), 'branches', BRANCH, 'events', 'by-manager'),
        row('manager-one'),
      );
    });
    const db = env.authenticatedContext('active-one').firestore();
    await assertFails(getDoc(doc(db, 'branches', BRANCH, 'events', 'by-manager')));
  });

  it('זר אינו קורא כלום', async () => {
    await seed();
    const db = env.authenticatedContext('stranger').firestore();
    await assertFails(getDoc(doc(db, 'branches', BRANCH, 'events', 'existing')));
  });
});

describe('הגבול בין סלונים', () => {
  it('⚠️ מנהלת בתל אביב אינה סורקת את השורות של ירושלים', async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (context) => {
      // מנהלת בתל אביב, וחברה בלבד בירושלים.
      await setDoc(doc(context.firestore(), 'branches', OTHER, 'members', 'manager-one'), {
        uid: 'manager-one', displayName: 'מנהלת', email: 'm@b.c',
        role: 'member', status: 'active',
      });
    });
    const db = env.authenticatedContext('manager-one').firestore();
    await assertFails(getDocs(collection(db, 'branches', OTHER, 'events')));
  });

  it('⚠️ וחבר אינו כותב שורה בסלון שאינו חבר בו', async () => {
    await seed();
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'branches', 'haifa'), { name: 'חיפה' });
    });
    const db = env.authenticatedContext('active-one').firestore();
    await assertFails(
      setDoc(doc(db, 'branches', 'haifa', 'events', 'nope'), row('active-one')),
    );
  });
});
