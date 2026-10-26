// test/functions/eligibility.test.mjs
//
// ⚠️ מה שעומד בין הקוד ובין הדפדפן הוא הפונקציה הזו, ולכן היא מה שנבדק.
// השאלה היחידה בכל בדיקה כאן: האם `code` הוא מחרוזת או `null`.
//
// הרצה: node --test test/functions/*.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  codeAnswerFor,
  currentCode,
  eligibilityFor,
  monthBounds,
  monthKeyNow,
} from '../../functions/eligibility.mjs';

/** 15/10/2026, 12:00 בשעון ישראל. */
const NOW = Date.parse('2026-10-15T09:00:00Z');

const CODE_OCT = { code: '4821', validFrom: Date.parse('2026-10-01T05:00:00Z'), periodMonth: '2026-10' };
const CODE_SEP = { code: '1111', validFrom: Date.parse('2026-09-01T05:00:00Z'), periodMonth: '2026-09' };
const CODE_FUTURE = { code: '9999', validFrom: Date.parse('2026-11-01T05:00:00Z'), periodMonth: '2026-11' };

const shift = (date, fields) => ({ date, assigneeMemberId: null, ...fields });

describe('הקוד שנשלח לדפדפן', () => {
  it('⚠️⚠️ מי שלא השתבץ החודש אינו מקבל את הקוד, וזה הסבב כולו', () => {
    const answer = codeAnswerFor([], [CODE_OCT], 'dana', NOW);
    assert.equal(answer.code, null);
    // ⚠️ והוא כן יודע שיש קוד, אחרת המסך יאמר "עוד לא עודכן" וזה שקר.
    assert.equal(answer.hasCode, true);
    assert.equal(answer.isEligible, false);
    assert.equal(answer.reason, 'none');
  });

  it('מי שמשובץ החודש מקבל את הקוד', () => {
    const shifts = [shift('2026-10-07', { assigneeMemberId: 'dana' })];
    const answer = codeAnswerFor(shifts, [CODE_OCT], 'dana', NOW);
    assert.equal(answer.code, '4821');
    assert.equal(answer.reason, 'assigned');
    assert.deepEqual(answer.shiftDates, ['2026-10-07']);
  });

  it('⚠️ ומי שמצא מחליף שומר על הזכאות', () => {
    const shifts = [
      shift('2026-10-07', {
        assigneeMemberId: 'noa',
        handoverFromMemberId: 'dana',
        handoverState: 'completed',
      }),
    ];
    const answer = codeAnswerFor(shifts, [CODE_OCT], 'dana', NOW);
    assert.equal(answer.code, '4821');
    assert.equal(answer.reason, 'handedOver');
  });

  it('⚠️ ובקשת מחליף שלא נענתה אינה מזכה', () => {
    const shifts = [
      shift('2026-10-07', {
        assigneeMemberId: 'dana',
        handoverFromMemberId: 'dana',
        handoverState: 'requested',
      }),
    ];
    // כאן הוא עדיין המשובץ, ולכן הוא זכאי מהסיבה הראשונה.
    assert.equal(codeAnswerFor(shifts, [CODE_OCT], 'dana', NOW).reason, 'assigned');

    // וכאן הוא כבר אינו המשובץ, וההחלפה לא הושלמה.
    const released = [
      shift('2026-10-07', {
        assigneeMemberId: null,
        handoverFromMemberId: 'dana',
        handoverState: 'requested',
      }),
    ];
    assert.equal(codeAnswerFor(released, [CODE_OCT], 'dana', NOW).code, null);
  });

  it('משמרת בחודש אחר אינה מזכה בקוד של החודש הזה', () => {
    const shifts = [shift('2026-09-07', { assigneeMemberId: 'dana' })];
    assert.equal(codeAnswerFor(shifts, [CODE_OCT], 'dana', NOW).code, null);
  });

  it('כשאין קוד כלל, אין מה להסתיר ואין מה להציג', () => {
    const shifts = [shift('2026-10-07', { assigneeMemberId: 'dana' })];
    const answer = codeAnswerFor(shifts, [], 'dana', NOW);
    assert.equal(answer.hasCode, false);
    assert.equal(answer.code, null);
  });

  it('⚠️ קוד שהמנהלת לא החליפה נמדד מול החודש שלו, ומסומן כישן', () => {
    // הקוד של ספטמבר הוא הנוכחי. מי ששמר בספטמבר רואה אותו, ומי ששמר
    // באוקטובר אינו רואה. DOCS/PLANING/02-the-data-model.md
    const september = [shift('2026-09-07', { assigneeMemberId: 'dana' })];
    const october = [shift('2026-10-07', { assigneeMemberId: 'noa' })];

    const forDana = codeAnswerFor(september, [CODE_SEP], 'dana', NOW);
    assert.equal(forDana.code, '1111');
    assert.equal(forDana.codeIsStale, true);

    assert.equal(codeAnswerFor(october, [CODE_SEP], 'noa', NOW).code, null);
  });

  it('קוד שעוד לא נכנס לתוקף אינו הקוד הנוכחי', () => {
    const shifts = [shift('2026-10-07', { assigneeMemberId: 'dana' })];
    const answer = codeAnswerFor(shifts, [CODE_OCT, CODE_FUTURE], 'dana', NOW);
    assert.equal(answer.code, '4821');
  });

  it('האחרון שהוגדר הוא הנוכחי, ולא הראשון ברשימה', () => {
    const later = { code: '7777', validFrom: Date.parse('2026-10-09T05:00:00Z'), periodMonth: '2026-10' };
    assert.equal(currentCode([CODE_OCT, later], NOW).code, '7777');
    assert.equal(currentCode([later, CODE_OCT], NOW).code, '7777');
  });
});

describe('החודש והגבולות', () => {
  it('⚠️ החודש נמדד בשעון ישראל ולא בשעון השרת', () => {
    // 31/10/2026 ב-23:30 בשעון ישראל הוא כבר 21:30 UTC באותו יום, ואילו
    // 01/11 ב-00:30 בישראל הוא 31/10 ב-22:30 UTC. השרת ב-UTC היה אומר
    // אוקטובר, והחבר בישראל כבר בנובמבר.
    assert.equal(monthKeyNow(Date.parse('2026-10-31T22:30:00Z')), '2026-11');
    assert.equal(monthKeyNow(Date.parse('2026-10-31T21:30:00Z')), '2026-10');
  });

  it('הגבולות מכסים את כל ימי החודש', () => {
    assert.deepEqual(monthBounds('2026-10'), { from: '2026-10-01', to: '2026-10-31' });
    // ⚠️ ו-31 גם בחודש קצר. המפתח הוא מחרוזת, ו-`2026-02-31` אינו תאריך
    // אלא גבול עליון שכל ימי פברואר קטנים ממנו.
    assert.deepEqual(monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-31' });
  });

  it('החישוב מסנן לחודש גם כשהוזנו משמרות של חודשים אחרים', () => {
    const shifts = [
      shift('2026-09-30', { assigneeMemberId: 'dana' }),
      shift('2026-11-01', { assigneeMemberId: 'dana' }),
    ];
    assert.equal(eligibilityFor(shifts, 'dana', '2026-10').isEligible, false);
  });
});
