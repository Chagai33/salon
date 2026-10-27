// test/utils/importMonths.test.ts
//
// ⚠️ שלושת המצבים שהפרומפט דרש: חודש זהה, חודש אחר, ומעורב.
// DOCS/PLANING/57

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { splitByMonth } from '../../src/utils/importMonths.ts';
import type { ImportedDay } from '../../src/services/importService.ts';

function day(date: string, title = 'אירוע'): ImportedDay {
  return { date, note: '', access: 'unknown', confidence: 1, events: [{ title }] };
}

describe('⚠️ הפרדה לפי חודש', () => {
  it('הכול בחודש שנבחר', () => {
    const split = splitByMonth([day('2026-11-03'), day('2026-11-10')], '2026-11');
    assert.equal(split.chosen.length, 2);
    assert.equal(split.other.length, 0);
    assert.equal(split.suggested, undefined);
  });

  it('⚠️⚠️ הכול בחודש אחר, וזה המקרה שעלה 164 שניות', () => {
    const split = splitByMonth([day('2026-11-03'), day('2026-11-10')], '2026-10');
    assert.equal(split.chosen.length, 0);
    assert.equal(split.other.length, 2);
    assert.equal(split.suggested, '2026-11');
  });

  it('⚠️ מעורב: של החודש הנבחר מוצגים, והאחרים נספרים', () => {
    const split = splitByMonth(
      [day('2026-10-28'), day('2026-11-03'), day('2026-11-10')],
      '2026-10',
    );
    assert.deepEqual(
      split.chosen.map((item) => item.date),
      ['2026-10-28'],
    );
    assert.equal(split.other.length, 2);
    assert.equal(split.suggested, '2026-11');
  });

  it('⚠️ והחודש שמוצע הוא זה שיש לו הכי הרבה ימים', () => {
    const split = splitByMonth(
      [day('2026-09-01'), day('2026-11-03'), day('2026-11-10'), day('2026-11-17')],
      '2026-10',
    );
    assert.equal(split.suggested, '2026-11');
  });

  it('⚠️ ובתיקו נבחר המוקדם, כדי שההצעה תהיה קבועה', () => {
    const split = splitByMonth([day('2026-12-01'), day('2026-09-01')], '2026-10');
    assert.equal(split.suggested, '2026-09');
  });

  it('רשימה ריקה אינה מציעה כלום', () => {
    const split = splitByMonth([], '2026-10');
    assert.equal(split.chosen.length, 0);
    assert.equal(split.suggested, undefined);
  });

  it('⚠️ והסדר שבו הימים נקראו נשמר', () => {
    const split = splitByMonth(
      [day('2026-11-17'), day('2026-11-03'), day('2026-11-10')],
      '2026-11',
    );
    assert.deepEqual(
      split.chosen.map((item) => item.date),
      ['2026-11-17', '2026-11-03', '2026-11-10'],
    );
  });
});
