// test/utils/times.test.ts
//
// ⚠️ הבדיקה שמבדילה בין אירוע שחוצה חצות ובין טעות בשעות.
// DOCS/PLANING/42

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  closesOutsideHours,
  endsBeforeStart,
  minusMinutes,
  minutesOf,
  timeOf,
} from '../../src/utils/times.ts';

describe('קריאת שעה', () => {
  it('דקות מחצות, וחצות הוא אפס ולא חסר', () => {
    assert.equal(minutesOf('00:00'), 0);
    assert.equal(minutesOf('10:30'), 630);
    assert.equal(minutesOf('23:59'), 1439);
  });

  it('⚠️ ושעה שאינה בפורמט מחזירה undefined ולא אפס', () => {
    assert.equal(minutesOf(undefined), undefined);
    assert.equal(minutesOf(''), undefined);
    assert.equal(minutesOf('9:30'), undefined);
    assert.equal(minutesOf('24:00'), undefined);
    assert.equal(minutesOf('10:70'), undefined);
  });

  it('חזרה למחרוזת, עם אפס מוביל', () => {
    assert.equal(timeOf(0), '00:00');
    assert.equal(timeOf(570), '09:30');
    assert.equal(timeOf(-1), undefined);
  });
});

describe('חצי שעה לפני', () => {
  it('מורידה דקות באותו יום', () => {
    assert.equal(minusMinutes('19:00', 30), '18:30');
    assert.equal(minusMinutes('10:00', 30), '09:30');
    assert.equal(minusMinutes('00:20', 30), undefined);
  });

  it('שעה חסרה אינה מחזירה שעה', () => {
    assert.equal(minusMinutes(undefined, 30), undefined);
  });
});

describe('⚠️ אירוע שנגמר לפני שהתחיל', () => {
  it('סיום לפני התחלה הוא שגיאה', () => {
    assert.equal(endsBeforeStart('19:00', '18:00'), true);
  });

  it('סיום באותה שעה הוא שגיאה, כי אין לאירוע אורך', () => {
    assert.equal(endsBeforeStart('19:00', '19:00'), true);
  });

  it('סיום אחרי התחלה תקין', () => {
    assert.equal(endsBeforeStart('19:00', '22:00'), false);
  });

  it('⚠️⚠️ ואירוע שמסומן "ממשיך למחרת" תקין, גם 23:00 עד 01:00', () => {
    assert.equal(endsBeforeStart('23:00', '01:00', true), false);
  });

  it('⚠️ ובלי הסימון אותן שעות הן שגיאה. ההסקה היא מה שנדחה', () => {
    assert.equal(endsBeforeStart('23:00', '01:00'), true);
  });

  it('שדה ריק אינו שגיאה', () => {
    assert.equal(endsBeforeStart('19:00', undefined), false);
    assert.equal(endsBeforeStart(undefined, '19:00'), false);
    assert.equal(endsBeforeStart(undefined, undefined), false);
  });
});

describe('⚠️ שעת סגירה מוקדמת מול שעות הפתיחה', () => {
  const hours = { open: '10:00', close: '22:00' };

  it('בתוך השעות, תקין', () => {
    assert.equal(closesOutsideHours('18:00', hours), false);
    assert.equal(closesOutsideHours('10:00', hours), false);
  });

  it('⚠️ אחרי שעת הסגירה אינה סגירה מוקדמת. זו הדוגמה שנמדדה', () => {
    assert.equal(closesOutsideHours('23:00', hours), true);
    assert.equal(closesOutsideHours('22:00', hours), true);
  });

  it('לפני הפתיחה, שגיאה', () => {
    assert.equal(closesOutsideHours('09:30', hours), true);
  });

  it('יום בלי שעות פתיחה אינו נבדק. אין מול מה', () => {
    assert.equal(closesOutsideHours('23:00', null), false);
    assert.equal(closesOutsideHours('23:00', undefined), false);
  });
});
