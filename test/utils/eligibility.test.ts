// test/utils/eligibility.test.ts
//
// ⚠️⚠️ אזור ליבה. קוד שנחשף לחבר שאינו זכאי הוא כשל במוצר.
//
// ⚠️ וזהו העותק שבדפדפן. העותק שבשרת נבדק ב-`test/functions/eligibility.test.mjs`,
// ושני העותקים חייבים לומר אותו דבר: `src/utils/eligibility.ts` מול
// `functions/eligibility.mjs`. שינוי באחד הוא שינוי בשני, ולכן גם בדיקה אחת
// לכל אחד. DOCS/PLANING/15-the-code-is-not-enforced-yet.md
//
// הרצה: node --test --experimental-strip-types test/utils/eligibility.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { codeVisibilityFor, eligibilityFor } from '../../src/utils/eligibility.ts';
import type { AccessCode, Shift } from '../../src/types/index.ts';

const CODE_OCT: AccessCode = {
  id: '1',
  branchId: 'tel-aviv',
  code: '4821',
  validFrom: Date.parse('2026-10-01T05:00:00Z'),
  periodMonth: '2026-10',
  setBy: 'manager-one',
  setAt: Date.parse('2026-10-01T05:00:00Z'),
};

/** 15/10/2026. */
const NOW = Date.parse('2026-10-15T09:00:00Z');

function shift(date: string, fields: Partial<Shift> = {}): Shift {
  return {
    id: `${date}_morning`,
    branchId: 'tel-aviv',
    date,
    templateId: 'morning',
    startTime: '10:00',
    endTime: '14:00',
    attendance: 'assumed',
    handoverState: 'none',
    ...fields,
  };
}

describe('הזכאות לקוד', () => {
  it('⚠️⚠️ מי שלא השתבץ החודש אינו רואה את הקוד', () => {
    const visibility = codeVisibilityFor([], [CODE_OCT], 'dana', NOW);
    assert.equal(visibility.canSee, false);
    assert.equal(visibility.code, null);
  });

  it('ומי שמשובץ החודש רואה אותו', () => {
    const shifts = [shift('2026-10-07', { assigneeMemberId: 'dana' })];
    const visibility = codeVisibilityFor(shifts, [CODE_OCT], 'dana', NOW);
    assert.equal(visibility.code, '4821');
    assert.equal(visibility.eligibility.reason, 'assigned');
  });

  it('⚠️ ומי שמצא מחליף שומר על הזכאות', () => {
    const shifts = [
      shift('2026-10-07', {
        assigneeMemberId: 'noa',
        handoverFromMemberId: 'dana',
        handoverState: 'completed',
      }),
    ];
    assert.equal(eligibilityFor(shifts, 'dana', '2026-10').reason, 'handedOver');
  });

  it('⚠️⚠️ ושומר אותה גם אחרי שהמקבל שחרר את המשמרת', () => {
    /*
      נמדד בקוד 26/10/2026: `releaseShift` מחזיר את `handoverState` ל-`none`
      ואינו נוגע ב-`handoverFromMemberId`, ולכן התנאי הישן על המצב ביטל את
      הזכאות של מי שמסר בלי שהוא עשה דבר.

      ⚠️ בהכרעת בעל המוצר 26/10/2026, בלשונו *"4א"*: זו הפרה של הבטחה כתובה.
      DOCS/PLANING/10-shift-handover.md
    */
    const afterTakerReleased = [
      shift('2026-10-07', {
        handoverFromMemberId: 'dana',
        handoverState: 'none',
      }),
    ];
    const visibility = codeVisibilityFor(afterTakerReleased, [CODE_OCT], 'dana', NOW);
    assert.equal(visibility.code, '4821');
    assert.equal(visibility.eligibility.reason, 'handedOver');
  });

  it('ושומר אותה גם כשהמקבל ביקש מחליף בעצמו', () => {
    const takerAskedAgain = [
      shift('2026-10-07', {
        assigneeMemberId: 'noa',
        handoverFromMemberId: 'dana',
        handoverState: 'requested',
      }),
    ];
    assert.equal(codeVisibilityFor(takerAskedAgain, [CODE_OCT], 'dana', NOW).code, '4821');
    assert.equal(
      codeVisibilityFor(takerAskedAgain, [CODE_OCT], 'noa', NOW).eligibility.reason,
      'assigned',
    );
  });

  it('⚠️ ובקשת מחליף שלא נענתה אינה מזכה', () => {
    // ⚠️ בקשה פתוחה היא משמרת שעוד מוחזקת בידי המבקש, ואין בה שדה מוסר כלל.
    // השדה נכתב רק ברגע שמישהו לוקח, ואין בעץ מסלול שכותב אותו בבקשה.
    const released = [shift('2026-10-07', { handoverState: 'none' })];
    assert.equal(codeVisibilityFor(released, [CODE_OCT], 'dana', NOW).code, null);
  });

  it('משמרת בחודש אחר אינה מזכה בקוד של החודש הזה', () => {
    const shifts = [shift('2026-09-07', { assigneeMemberId: 'dana' })];
    assert.equal(codeVisibilityFor(shifts, [CODE_OCT], 'dana', NOW).code, null);
  });
});
