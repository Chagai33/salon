// test/rules/shifts.test.mjs
//
// ⚠️⚠️ אזור ליבה: הצד הכותב של הזכאות לקוד הכניסה.
// DOCS/PLANING/45-a-member-can-write-himself-onto-a-shift.md
//
// ⚠️ חוק הרשאות אינו מאומת בקריאה שלו. הוא מאומת בניסיון שאמור להיכשל,
// ובראייה שהוא נכשל. DOCS/PLANING/VERIFICATION-BUDGET.md
//
// ⚠️ ולכל כלל שני כיוונים: שהפעולה הלגיטימית עוברת, ושהחריגה נדחית. בדיקה
// שרק מאשרת את המותר אינה מודדת את הכלל.
//
// הרצה:
//   npx firebase emulators:exec --only firestore --project demo-salon \
//     "node --test --test-concurrency=1 test/rules/*.test.mjs"

import { after, before, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const BRANCH = 'tel-aviv';
const OTHER = 'haifa';

const as = (uid, email) => env.authenticatedContext(uid, email ? { email } : undefined).firestore();

/** נתיב משמרת בסניף תל אביב. */
const shift = (db, id) => doc(db, 'branches', BRANCH, 'shifts', id);

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

/** שבעת השדות שמשמרת נולדת איתם. `generateMonth`. */
function born(date, templateId) {
  return {
    branchId: BRANCH,
    date,
    templateId,
    startTime: '10:00',
    endTime: '14:00',
    attendance: 'assumed',
    handoverState: 'none',
  };
}

/**
 * מצב פתיחה: שני סניפים, ארבעה חברים, וארבע משמרות בארבעה מצבים.
 *
 * `open-1` פנויה, `held-1` מוחזקת בידי `active-one`, `req-1` מוחזקת בידיו
 * ומבוקש לה מחליף, ו-`done-1` עברה החלפה ש-`active-two` השלים.
 */
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'branches', BRANCH), { name: 'הסלון בתל אביב' });
    await setDoc(doc(db, 'branches', OTHER), { name: 'הסלון בחיפה' });

    await setDoc(doc(db, 'branches', BRANCH, 'members', 'active-one'), {
      uid: 'active-one', displayName: 'פעיל', email: 'a@b.c', role: 'member', status: 'active',
    });
    await setDoc(doc(db, 'branches', BRANCH, 'members', 'active-two'), {
      uid: 'active-two', displayName: 'פעילה', email: 'b@b.c', role: 'member', status: 'active',
    });
    await setDoc(doc(db, 'branches', BRANCH, 'members', 'pending-one'), {
      uid: 'pending-one', displayName: 'ממתין', email: 'p@b.c', role: 'member', status: 'pending',
    });
    await setDoc(doc(db, 'branches', BRANCH, 'members', 'manager-one'), {
      uid: 'manager-one', displayName: 'מנהלת', email: 'm@b.c', role: 'manager', status: 'active',
    });
    await setDoc(doc(db, 'branches', OTHER, 'members', 'other-one'), {
      uid: 'other-one', displayName: 'חיפאי', email: 'h@b.c', role: 'member', status: 'active',
    });

    await setDoc(shift(db, 'open-1'), born('2026-10-05', 'morning'));
    await setDoc(shift(db, 'held-1'), {
      ...born('2026-10-06', 'morning'),
      assigneeMemberId: 'active-one',
      assigneeName: 'פעיל',
      assignedAt: 1,
      assignedBy: 'active-one',
    });
    await setDoc(shift(db, 'req-1'), {
      ...born('2026-10-07', 'morning'),
      assigneeMemberId: 'active-one',
      assigneeName: 'פעיל',
      assignedAt: 1,
      assignedBy: 'active-one',
      handoverState: 'requested',
      handoverRequestedAt: 2,
    });
    await setDoc(shift(db, 'done-1'), {
      ...born('2026-10-08', 'morning'),
      assigneeMemberId: 'active-two',
      assigneeName: 'פעילה',
      assignedAt: 3,
      assignedBy: 'active-two',
      handoverState: 'completed',
      handoverFromMemberId: 'active-one',
      handoverFromName: 'פעיל',
    });
  });
}

describe('יצירת משמרת', () => {
  it('מנהלת מולידה משמרת', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertSucceeds(setDoc(shift(db, '2026-11-02_morning'), born('2026-11-02', 'morning')));
  });

  it('חבר אינו מוליד משמרת', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertFails(setDoc(shift(db, '2026-11-02_morning'), born('2026-11-02', 'morning')));
  });

  it('⚠️ ומשמרת נולדת פנויה: גם מנהלת אינה מולידה משמרת משובצת', async () => {
    await seed();
    // ⚠️ זו הדרך לעקוף את כל ענפי העדכון: להוליד את המשמרת כשהשיבוץ בתוכה.
    const db = as('manager-one', 'm@b.c');
    await assertFails(
      setDoc(shift(db, '2026-11-03_morning'), {
        ...born('2026-11-03', 'morning'),
        assigneeMemberId: 'manager-one',
      }),
    );
  });

  it('ונולדת בנוכחות ברירת המחדל', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertFails(
      setDoc(shift(db, '2026-11-04_morning'), {
        ...born('2026-11-04', 'morning'),
        attendance: 'confirmed',
      }),
    );
  });
});

describe('חבר לוקח משמרת פנויה', () => {
  it('חבר לוקח משמרת פנויה, ובזה הוא זכאי', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertSucceeds(
      updateDoc(shift(db, 'open-1'), {
        assigneeMemberId: 'active-one',
        assigneeName: 'פעיל',
        assignedAt: 10,
        assignedBy: 'active-one',
      }),
    );
  });

  it('⚠️ וחבר אינו כותב אדם אחר על משמרת פנויה', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertFails(
      updateDoc(shift(db, 'open-1'), {
        assigneeMemberId: 'active-two',
        assigneeName: 'פעילה',
        assignedAt: 10,
        assignedBy: 'active-one',
      }),
    );
  });

  it('⚠️⚠️ והכתיבה שנמדדה: חבר אינו כותב את עצמו על משמרת של אדם אחר', async () => {
    await seed();
    // זו הכתיבה שסוכן האימות הריץ והצליח, 26/10/2026. רשומה 45.
    const db = as('active-two', 'b@b.c');
    await assertFails(updateDoc(shift(db, 'held-1'), { assigneeMemberId: 'active-two' }));
  });

  it('⚠️ וחבר אינו מזיז את המשמרת לחודש אחר יחד עם הלקיחה', async () => {
    await seed();
    // ⚠️ תאריך הוא מה שקובע לאיזה חודש הזכאות נספרת. DOCS/PLANING/43
    const db = as('active-one', 'a@b.c');
    await assertFails(
      updateDoc(shift(db, 'open-1'), {
        assigneeMemberId: 'active-one',
        assigneeName: 'פעיל',
        assignedAt: 10,
        assignedBy: 'active-one',
        date: '2026-11-05',
      }),
    );
  });

  it('וחבר אינו מסמן נוכחות יחד עם הלקיחה', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertFails(
      updateDoc(shift(db, 'open-1'), {
        assigneeMemberId: 'active-one',
        assigneeName: 'פעיל',
        assignedAt: 10,
        assignedBy: 'active-one',
        attendance: 'confirmed',
      }),
    );
  });

  it('וממתין לאישור אינו לוקח משמרת', async () => {
    await seed();
    const db = as('pending-one', 'p@b.c');
    await assertFails(
      updateDoc(shift(db, 'open-1'), {
        assigneeMemberId: 'pending-one',
        assigneeName: 'ממתין',
        assignedAt: 10,
        assignedBy: 'pending-one',
      }),
    );
  });
});

describe('לקיחת משמרת שמבוקש לה מחליף', () => {
  it('חבר שני לוקח, ומי שמסר נשמר על המשמרת', async () => {
    await seed();
    const db = as('active-two', 'b@b.c');
    await assertSucceeds(
      updateDoc(shift(db, 'req-1'), {
        assigneeMemberId: 'active-two',
        assigneeName: 'פעילה',
        assignedAt: 20,
        assignedBy: 'active-two',
        handoverState: 'completed',
        handoverFromMemberId: 'active-one',
        handoverFromName: 'פעיל',
      }),
    );
  });

  it('⚠️⚠️ והכתיבה השנייה שנמדדה: חבר אינו כותב את עצמו כמי שמסר', async () => {
    await seed();
    // ⚠️ זו הדרך הזולה אל הזכאות: שתי מילים, בלי לגעת בשיבוץ עצמו. רשומה 45.
    const db = as('active-two', 'b@b.c');
    await assertFails(
      updateDoc(shift(db, 'held-1'), {
        handoverFromMemberId: 'active-two',
        handoverState: 'completed',
      }),
    );
  });

  it('ואותה כתיבה נחסמת גם על משמרת שמבוקש לה מחליף', async () => {
    await seed();
    const db = as('active-two', 'b@b.c');
    await assertFails(
      updateDoc(shift(db, 'req-1'), {
        handoverFromMemberId: 'active-two',
        handoverState: 'completed',
      }),
    );
  });

  it('⚠️ ומי שלוקח אינו רושם אדם שלישי כמי שמסר', async () => {
    await seed();
    const db = as('active-two', 'b@b.c');
    await assertFails(
      updateDoc(shift(db, 'req-1'), {
        assigneeMemberId: 'active-two',
        assigneeName: 'פעילה',
        assignedAt: 20,
        assignedBy: 'active-two',
        handoverState: 'completed',
        handoverFromMemberId: 'pending-one',
        handoverFromName: 'ממתין',
      }),
    );
  });

  it('ואי אפשר לקחת משמרת שלא מבוקש לה מחליף', async () => {
    await seed();
    const db = as('active-two', 'b@b.c');
    await assertFails(
      updateDoc(shift(db, 'held-1'), {
        assigneeMemberId: 'active-two',
        assigneeName: 'פעילה',
        assignedAt: 20,
        assignedBy: 'active-two',
        handoverState: 'completed',
        handoverFromMemberId: 'active-one',
        handoverFromName: 'פעיל',
      }),
    );
  });

  it('⚠️ והמבקש אינו לוקח את המשמרת של עצמו', async () => {
    await seed();
    // הלינק שהוא משתף בקבוצה מגיע גם אליו. DOCS/PLANING/28
    const db = as('active-one', 'a@b.c');
    await assertFails(
      updateDoc(shift(db, 'req-1'), {
        assigneeMemberId: 'active-one',
        assigneeName: 'פעיל',
        assignedAt: 20,
        assignedBy: 'active-one',
        handoverState: 'completed',
        handoverFromMemberId: 'active-one',
        handoverFromName: 'פעיל',
      }),
    );
  });
});

describe('בקשת מחליף וביטולה', () => {
  it('המחזיק מבקש מחליף', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertSucceeds(
      updateDoc(shift(db, 'held-1'), {
        handoverState: 'requested',
        handoverRequestedAt: 30,
        handoverReason: null,
      }),
    );
  });

  it('⚠️ ומי שאינו מחזיק אינו מבקש מחליף על משמרת של אחר', async () => {
    await seed();
    const db = as('active-two', 'b@b.c');
    await assertFails(
      updateDoc(shift(db, 'held-1'), {
        handoverState: 'requested',
        handoverRequestedAt: 30,
        handoverReason: null,
      }),
    );
  });

  it('המחזיק מבטל את הבקשה', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertSucceeds(
      updateDoc(shift(db, 'req-1'), {
        handoverState: 'none',
        handoverRequestedAt: null,
        handoverReason: null,
      }),
    );
  });

  it('⚠️ והמחזיק אינו מסיים את ההחלפה בעצמו', async () => {
    await seed();
    // השלמת החלפה היא לקיחה, ולקיחה מחייבת שהלוקח יהיה המשובץ החדש.
    const db = as('active-one', 'a@b.c');
    await assertFails(
      updateDoc(shift(db, 'req-1'), {
        handoverState: 'completed',
        handoverRequestedAt: null,
        handoverReason: null,
      }),
    );
  });
});

describe('שחרור', () => {
  it('המחזיק משחרר את המשמרת של עצמו', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertSucceeds(
      updateDoc(shift(db, 'held-1'), {
        assigneeMemberId: null,
        assigneeName: null,
        assignedAt: null,
        assignedBy: null,
        handoverState: 'none',
        handoverRequestedAt: null,
        handoverReason: null,
      }),
    );
  });

  it('⚠️ וחבר אינו משחרר משמרת של אדם אחר', async () => {
    await seed();
    const db = as('active-two', 'b@b.c');
    await assertFails(
      updateDoc(shift(db, 'held-1'), {
        assigneeMemberId: null,
        assigneeName: null,
        assignedAt: null,
        assignedBy: null,
        handoverState: 'none',
        handoverRequestedAt: null,
        handoverReason: null,
      }),
    );
  });

  it('ומנהלת משחררת משמרת של חבר', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertSucceeds(
      updateDoc(shift(db, 'held-1'), {
        assigneeMemberId: null,
        assigneeName: null,
        assignedAt: null,
        assignedBy: null,
        handoverState: 'none',
        handoverRequestedAt: null,
        handoverReason: null,
      }),
    );
  });

  it('⚠️⚠️ ושחרור אינו מוחק את מי שמסר, כי זו שלילת זכאות בשקט', async () => {
    await seed();
    // DOCS/PLANING/10-shift-handover.md, "לא לאבד את מי שמסר".
    const db = as('active-two', 'b@b.c');
    await assertFails(
      updateDoc(shift(db, 'done-1'), {
        assigneeMemberId: null,
        assigneeName: null,
        assignedAt: null,
        assignedBy: null,
        handoverState: 'none',
        handoverRequestedAt: null,
        handoverReason: null,
        handoverFromMemberId: null,
        handoverFromName: null,
      }),
    );
  });
});

describe('נוכחות', () => {
  it('מנהלת מסמנת נוכחות', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertSucceeds(
      updateDoc(shift(db, 'held-1'), {
        attendance: 'noShow',
        attendanceSetBy: 'manager-one',
        attendanceSetAt: 40,
      }),
    );
  });

  it('⚠️ וחבר אינו מסמן נוכחות, גם לא על המשמרת של עצמו', async () => {
    await seed();
    // הנוכחות אינה מזכה, ובכל זאת היא רשומה שלילית על אדם.
    const db = as('active-one', 'a@b.c');
    await assertFails(
      updateDoc(shift(db, 'held-1'), {
        attendance: 'confirmed',
        attendanceSetBy: 'active-one',
        attendanceSetAt: 40,
      }),
    );
  });
});

describe('התאריך, התבנית והשעות נעולים לכולם', () => {
  it('⚠️⚠️ ומנהלת אינה מזיזה משמרת לתאריך אחר', async () => {
    await seed();
    // בהכרעת בעל המוצר 26/10/2026, "2א".
    const db = as('manager-one', 'm@b.c');
    await assertFails(updateDoc(shift(db, 'held-1'), { date: '2026-11-06' }));
  });

  it('וחבר אינו משנה את שעות המשמרת', async () => {
    await seed();
    const db = as('active-one', 'a@b.c');
    await assertFails(updateDoc(shift(db, 'held-1'), { endTime: '23:00' }));
  });

  it('ואין מחיקה לאיש, גם לא למנהלת', async () => {
    await seed();
    const db = as('manager-one', 'm@b.c');
    await assertFails(deleteDoc(shift(db, 'held-1')));
  });
});

describe('הגבול בין סלונים', () => {
  it('חבר פעיל בסלון אחר אינו נוגע במשמרת כאן', async () => {
    await seed();
    const db = as('other-one', 'h@b.c');
    await assertFails(
      updateDoc(shift(db, 'open-1'), {
        assigneeMemberId: 'other-one',
        assigneeName: 'חיפאי',
        assignedAt: 50,
        assignedBy: 'other-one',
      }),
    );
  });
});
