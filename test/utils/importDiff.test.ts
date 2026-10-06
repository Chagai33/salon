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

  it('⚠️ והאירוע שתיעלם מסומן כהתנגשות ולא נשמר בשקט', () => {
    const plan = planFor(secondRead, edited, WEEKDAY);
    assert.equal(plan.verdict, 'conflict');
    assert.deepEqual(
      plan.changes.filter((change) => change.kind === 'erase').map((change) => change.text),
      ['יוסר: חוג ערבית 20:30'],
    );
  });

  it('ו-source אינו נכתב, כלומר העדות שאדם נגע ביום נשמרת', () => {
    assert.equal('source' in planFor(secondRead, edited, WEEKDAY).fields, false);
  });

  it('⚠️ ושעת סגירה שנשארת נאמרת, כי המצב אינו עקבי', () => {
    const plan = planFor(read({ access: 'open', events: [] }), edited, WEEKDAY);
    assert.ok(plan.changes.some((change) => change.kind === 'keep' && change.text.includes('16:00')));
  });
});

describe('ומה שאינו התנגשות', () => {
  it('קריאה זהה לרשומה אינה כותבת כלום', () => {
    const stored = storedDay({ events: [{ title: 'פילוסופיה', startTime: '19:00' }] });
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
    assert.equal(plan.verdict, 'conflict');
  });
});
