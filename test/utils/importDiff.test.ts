// test/utils/importDiff.test.ts
//
// ⚠️⚠️ נכתב מתוך מה שנמדד מול האמולטור, ולא מתוך קריאת הקוד.
// ייבוא שני לאותו חודש מחק את ההערה, הסיר אירוע שנוסף ביד, והחזיר יום סגור
// למצב פתוח לכולם. DOCS/PLANING/25-the-second-import-erases-the-manager-edit.md
//
// הרצה: node --test --experimental-strip-types test/utils/importDiff.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planFor } from '../../src/utils/importDiff.ts';
import type { FallbackAccess } from '../../src/utils/importDiff.ts';
import type { ActivityDay } from '../../src/types/index.ts';
import type { ImportedDay } from '../../src/services/importService.ts';

function read(partial: Partial<ImportedDay> = {}): ImportedDay {
  return {
    date: '2026-10-20',
    note: '',
    access: 'unknown',
    events: [],
    confidence: 1,
    ...partial,
  };
}

function storedDay(partial: Partial<ActivityDay> = {}): ActivityDay {
  return {
    id: '2026-10-20',
    branchId: 'telaviv',
    date: '2026-10-20',
    events: [],
    publicAccess: 'open',
    memberAccess: 'open',
    ...partial,
  };
}

/** ⚠️ מה שיום רגיל נושא ממילא, ומה שיום שישי נושא. `dayAccessOf` מחזיר אותם. */
const WEEKDAY: FallbackAccess = { publicAccess: 'open', memberAccess: 'open' };
const WEEKEND: FallbackAccess = { publicAccess: 'closed', memberAccess: 'open' };

describe('יום שאין לו רשומה', () => {
  it('נכתב במלואו, ואין מה לאבד', () => {
    const plan = planFor(read({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] }), undefined, WEEKDAY);
    assert.equal(plan.verdict, 'new');
    assert.equal(plan.fields.source, 'import2026');
    assert.deepEqual(plan.fields.events, [{ title: 'פילוסופיה', startTime: '19:00' }]);
  });

  it('⚠️ ומצב שהמודל לא קרא נלקח מברירת המחדל, ולא נכתב כפתוח לכולם', () => {
    // 2026-10-24 הוא יום שישי, וזה מה ש-dayAccessOf מחזיר לו.
    const plan = planFor(read({ date: '2026-10-24', events: [{ title: 'משהו' }] }), undefined, WEEKEND);
    assert.equal(plan.fields.publicAccess, 'closed');
    assert.equal(plan.fields.memberAccess, 'open');
  });

  it('והערה ריקה אינה נשלחת בכלל', () => {
    const plan = planFor(read({ events: [{ title: 'משהו' }] }), undefined, WEEKDAY);
    assert.equal('note' in plan.fields, false);
  });
});

describe('⚠️ יום שהמנהלת ערכה, וזה הבאג', () => {
  const edited = storedDay({
    note: 'אירוע פרטי, הסלון סגור',
    closesAt: '16:00',
    events: [
      { title: 'פילוסופיה', startTime: '19:00' },
      { title: 'חוג ערבית', startTime: '20:30' },
    ],
    publicAccess: 'closed',
    memberAccess: 'closed',
    source: 'app',
  });

  const secondRead = read({
    access: 'unknown',
    note: '',
    events: [{ title: 'פילוסופיה', startTime: '19:00' }],
  });

  it('ההערה שלה אינה נמחקת, כי הערה ריקה אינה נשלחת', () => {
    assert.equal('note' in planFor(secondRead, edited, WEEKDAY).fields, false);
  });

  it('⚠️ ומצב היום אינו משתנה כשהמודל שתק', () => {
    const { fields } = planFor(secondRead, edited, WEEKDAY);
    assert.equal('publicAccess' in fields, false);
    assert.equal('memberAccess' in fields, false);
  });

  /*
    ⚠️⚠️ והבדיקה הזאת התהפכה ב-26/10/2026, בהכרעת בעל המוצר ("1א").

    קודם היא דרשה שאירוע שלא נקרא יסומן כהתנגשות, **ועכשיו הוא פשוט אינו
    מוסר.** ⚠️ ורשומה 25 אינה נפגעת אלא מתחזקת: היא אסרה על מחיקה בשקט,
    **והמיזוג אינו מוחק כלל.** DOCS/PLANING/56
  */
  it('⚠️⚠️ והאירוע שלא נקרא אינו מוסר בכלל, ואין מה לאשר', () => {
    const plan = planFor(secondRead, edited, WEEKDAY);
    assert.equal(
      plan.changes.some((change) => change.text.includes('חוג ערבית')),
      false,
    );
    assert.equal('events' in plan.fields, false);
  });

  it('ו-source אינו נכתב, כלומר העדות שאדם נגע ביום נשמרת', () => {
    assert.equal('source' in planFor(secondRead, edited, WEEKDAY).fields, false);
  });

  it('⚠️ ושעת סגירה שנשארת נאמרת, כי המצב אינו עקבי', () => {
    /*
      ⚠️ ויום בלי אירועים, כי מ-26/10 שעת הסגירה נגזרת מהאירועים של היום
      ואינה נשארת כשיש מה לגזור ממנו. DOCS/PLANING/38
    */
    const quiet = storedDay({
      closesAt: '16:00',
      publicAccess: 'closed',
      memberAccess: 'closed',
      source: 'app',
    });
    const plan = planFor(read({ access: 'open', events: [] }), quiet, WEEKDAY);
    assert.ok(plan.changes.some((change) => change.kind === 'keep' && change.text.includes('16:00')));
  });
});

describe('ומה שאינו התנגשות', () => {
  it('קריאה זהה לרשומה אינה כותבת כלום', () => {
    /*
      ⚠️ והיום נושא כבר את הסגירה שנגזרת מהאירוע, 18:30, מ-26/10/2026.
      בלעדיה הייבוא כן היה כותב משהו, וזו בדיוק הבקשה. DOCS/PLANING/38
    */
    const stored = storedDay({
      events: [{ title: 'פילוסופיה', startTime: '19:00' }],
      publicAccess: 'closesEarly',
      closesAt: '18:30',
    });
    const plan = planFor(read({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] }), stored, WEEKDAY);
    assert.equal(plan.verdict, 'same');
    assert.deepEqual(Object.keys(plan.fields), ['date']);
  });

  it('תוספת בלבד אינה התנגשות', () => {
    const stored = storedDay({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] });
    const plan = planFor(
      read({
        events: [{ title: 'פילוסופיה', startTime: '19:00' }, { title: 'חוג ערבית', startTime: '20:30' }],
        note: 'הערה חדשה',
      }),
      stored,
      WEEKDAY,
    );
    assert.equal(plan.verdict, 'adds');
    assert.equal(plan.fields.note, 'הערה חדשה');
  });

  it('⚠️ ושעה שונה היא אירוע אחר, ולא אותו אירוע', () => {
    const stored = storedDay({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] });
    const plan = planFor(read({ events: [{ title: 'פילוסופיה', startTime: '20:30' }] }), stored, WEEKDAY);
    /*
      ⚠️ ומ-26/10 זו תוספת ולא התנגשות: שני האירועים נשמרים, כי הייבוא אינו
      מוחק. DOCS/PLANING/56
    */
    assert.equal(plan.verdict, 'adds');
    assert.equal(plan.fields.events?.length, 2);
  });
});

/*
  ⚠️⚠️ הדבקה חלקית מוסיפה ואינה מוחקת, בהכרעת בעל המוצר 26/10 ("1א").

  בעל המוצר הדביק שורת טקסט אחת, ושני אירועים קיימים סומנו להסרה.
  DOCS/PLANING/56
*/
describe('⚠️ הייבוא מוסיף ואינו מוחק', () => {
  const twoEvents = storedDay({
    events: [
      { title: 'סינמה בסלון', startTime: '19:30' },
      { title: 'סתם אירוע' },
    ],
  });

  it('⚠️⚠️ שורה אחת שהודבקה אינה מסמנת את השניים הקיימים להסרה', () => {
    const plan = planFor(read({ events: [{ title: 'סלון בסלון' }] }), twoEvents, WEEKDAY);
    assert.equal(plan.verdict, 'adds');
    assert.equal(
      plan.changes.some((change) => change.kind === 'erase'),
      false,
    );
  });

  it('⚠️ והיום נשמר עם שלושת האירועים, בסדר: הקיימים ואז החדש', () => {
    const plan = planFor(read({ events: [{ title: 'סלון בסלון' }] }), twoEvents, WEEKDAY);
    assert.deepEqual(
      plan.fields.events?.map((event) => event.title),
      ['סינמה בסלון', 'סתם אירוע', 'סלון בסלון'],
    );
  });

  it('⚠️ וקריאה שנייה של אותו אירוע אינה יוצרת כפילות', () => {
    const plan = planFor(
      read({ events: [{ title: 'סינמה בסלון', startTime: '19:30' }] }),
      twoEvents,
      WEEKDAY,
    );
    // ⚠️ רשימת האירועים אינה נוגעת. מה שכן משתנה ביום הזה הוא שעת הסגירה,
    //    שנגזרת מהאירוע, DOCS/PLANING/38.
    assert.equal('events' in plan.fields, false);
  });

  it('⚠️⚠️ ושעת הסגירה נגזרת מהרשימה שתישמר, ולא ממה שנקרא', () => {
    const stored = storedDay({ events: [{ title: 'בוקר', startTime: '10:15' }] });
    const plan = planFor(
      read({ events: [{ title: 'ערב', startTime: '19:00' }] }),
      stored,
      WEEKDAY,
      { open: '10:00', close: '22:00' },
    );
    /*
      ⚠️ היום תפוס מ-10:15, ולכן 09:45 הנגזרת מוקדמת מהפתיחה והיום סגור
      לציבור. **ולא 18:30**, שהיה יוצא מהאירוע שנקרא לבדו.
    */
    assert.equal(plan.fields.publicAccess, 'closed');
    assert.equal('closesAt' in plan.fields, false);
  });

  it('⚠️⚠️ וחלל שהמנהלת שייכה בחלון הייבוא נשמר, ואינו נבלע', () => {
    const stored = storedDay({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] });
    const plan = planFor(
      read({ events: [{ title: 'פילוסופיה', startTime: '19:00', spaceId: 'big' }] }),
      stored,
      WEEKDAY,
    );
    assert.equal(plan.verdict, 'adds');
    assert.equal(plan.fields.events?.length, 1);
    assert.equal(plan.fields.events?.[0].spaceId, 'big');
  });

  it('⚠️⚠️ וחלל שהמנהלת כתבה בעורך היום אינו נמחק בייבוא ששתק בו', () => {
    const stored = storedDay({
      events: [{ title: 'פילוסופיה', startTime: '19:00', spaceId: 'quiet' }],
    });
    const plan = planFor(
      read({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] }),
      stored,
      WEEKDAY,
    );
    // ⚠️ רשימת האירועים אינה נשלחת בכלל, ולכן החלל שלה נשאר במקומו.
    assert.equal('events' in plan.fields, false);
  });

  it('⚠️⚠️ וחלל אחר על אירוע שכבר יש לו חלל הוא דריסה, ומחכה לאישור', () => {
    const stored = storedDay({
      events: [{ title: 'פילוסופיה', startTime: '19:00', spaceId: 'quiet' }],
    });
    const plan = planFor(
      read({ events: [{ title: 'פילוסופיה', startTime: '19:00', spaceId: 'big' }] }),
      stored,
      WEEKDAY,
    );
    assert.equal(plan.verdict, 'conflict');
    assert.equal(plan.fields.events?.[0].spaceId, 'big');
  });

  it('⚠️ ו"ממשיך למחרת" שנסמן בחלון הייבוא נשמר', () => {
    const stored = storedDay({
      events: [{ title: 'מסיבה', startTime: '23:00', endTime: '01:00' }],
    });
    const plan = planFor(
      read({ events: [{ title: 'מסיבה', startTime: '23:00', endTime: '01:00', endsNextDay: true }] }),
      stored,
      WEEKDAY,
    );
    assert.equal(plan.fields.events?.[0].endsNextDay, true);
  });
});

/*
  ⚠️⚠️ חצי שעה לפני האירוע, בבקשת בעל המוצר 26/10/2026.
  "למשל אירע שמתחיל ב 19:00 יכריז על הסלון כסגור כבר ב 18:30".
  DOCS/PLANING/38
*/
describe('⚠️ חצי שעה לפני האירוע', () => {
  const HOURS = { open: '10:00', close: '22:00' };

  it('יום חדש נסגר חצי שעה לפני האירוע, והשעה נכתבת למסד', () => {
    const plan = planFor(
      read({ events: [{ title: 'NLP הרצאה', startTime: '19:00' }] }),
      undefined,
      WEEKDAY,
      HOURS,
    );
    assert.equal(plan.fields.publicAccess, 'closesEarly');
    assert.equal(plan.fields.closesAt, '18:30');
  });

  it('⚠️ והשעה המוקדמת מבין האירועים קובעת, ולא האחרון', () => {
    const plan = planFor(
      read({
        events: [
          { title: 'חוג ערבית', startTime: '20:30' },
          { title: 'פילוסופיה', startTime: '19:00' },
        ],
      }),
      undefined,
      WEEKDAY,
      HOURS,
    );
    assert.equal(plan.fields.closesAt, '18:30');
  });

  it('⚠️ ושם האירוע שגרם לסגירה נאמר למנהלת', () => {
    const plan = planFor(
      read({ events: [{ title: 'NLP הרצאה', startTime: '19:00' }] }),
      undefined,
      WEEKDAY,
      HOURS,
    );
    assert.ok(plan.changes.some((change) => change.text.includes('לקראת NLP הרצאה')));
  });

  it('אירוע בלי שעת התחלה אינו גוזר כלום', () => {
    const plan = planFor(read({ events: [{ title: 'משהו' }] }), undefined, WEEKDAY, HOURS);
    assert.equal(plan.fields.publicAccess, 'open');
    assert.equal('closesAt' in plan.fields, false);
  });

  it('יום בלי אירועים אינו נסגר מוקדם', () => {
    const plan = planFor(read({ events: [] }), undefined, WEEKDAY, HOURS);
    assert.equal(plan.fields.publicAccess, 'open');
  });

  it('⚠️⚠️ ושעה שמוקדמת מהפתיחה הופכת את היום לסגור לציבור, בלי שעת סגירה', () => {
    const plan = planFor(
      read({ events: [{ title: 'בוקר טוב', startTime: '10:00' }] }),
      undefined,
      WEEKDAY,
      HOURS,
    );
    assert.equal(plan.fields.publicAccess, 'closed');
    assert.equal(plan.fields.memberAccess, 'open');
    assert.equal('closesAt' in plan.fields, false);
  });

  it('⚠️ ושישי אינו נסגר מוקדם, כי הוא סגור לציבור ממילא', () => {
    const plan = planFor(
      read({ date: '2026-10-24', events: [{ title: 'משהו', startTime: '19:00' }] }),
      undefined,
      WEEKEND,
      null,
    );
    assert.equal(plan.fields.publicAccess, 'closed');
    assert.equal('closesAt' in plan.fields, false);
  });

  it('⚠️ ויום פתוח קיים מקבל את הסגירה כתוספת ולא כהתנגשות', () => {
    const stored = storedDay({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] });
    const plan = planFor(
      read({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] }),
      stored,
      WEEKDAY,
      HOURS,
    );
    assert.equal(plan.verdict, 'adds');
    assert.equal(plan.fields.closesAt, '18:30');
  });

  it('⚠️⚠️ ויום שהמנהלת ערכה הוא התנגשות, גם כשאין בו שעת סגירה כלל', () => {
    const stored = storedDay({
      events: [{ title: 'פילוסופיה', startTime: '19:00' }],
      source: 'app',
    });
    const plan = planFor(
      read({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] }),
      stored,
      WEEKDAY,
      HOURS,
    );
    assert.equal(plan.verdict, 'conflict');
  });

  it('⚠️⚠️ ושעה שהמנהלת כתבה ביד מוצגת כהחלפה ואינה נכתבת בשקט', () => {
    const stored = storedDay({
      events: [{ title: 'פילוסופיה', startTime: '19:00' }],
      publicAccess: 'closesEarly',
      closesAt: '16:00',
      source: 'app',
    });
    const plan = planFor(
      read({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] }),
      stored,
      WEEKDAY,
      HOURS,
    );
    assert.equal(plan.verdict, 'conflict');
    assert.ok(
      plan.changes.some(
        (change) => change.kind === 'erase' && change.text.includes('16:00'),
      ),
    );
  });
});
