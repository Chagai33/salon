// test/functions/branch-deletion.test.mjs
//
// ⚠️⚠️ סגירה ומחיקה של סלון. מחיקה אינה הפיכה, ולכן כל מעבר נבדק.
// DOCS/PLANING/35-there-is-no-way-to-delete-a-salon.md
//
// הרצה: node --test test/functions/*.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS,
  BRANCH_ID,
  DELETION_DAYS,
  deleteAfterFrom,
  isDue,
  planAction,
} from '../../functions/branch-deletion.mjs';

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const DAY = 86_400_000;

describe('30 הימים', () => {
  it('⚠️ 30 יום, בהכרעת בעל המוצר 12/10', () => {
    assert.equal(DELETION_DAYS, 30);
    assert.equal(deleteAfterFrom(NOW), NOW + 30 * DAY);
  });

  it('יום לפני המועד, לא נמחק', () => {
    assert.equal(isDue(deleteAfterFrom(NOW), NOW + 29 * DAY), false);
  });

  it('במועד, נמחק', () => {
    assert.equal(isDue(deleteAfterFrom(NOW), NOW + 30 * DAY), true);
  });

  it('⚠️ ערך שאינו מספר אינו "הגיע הזמן", כדי שבאג לא יהפוך למחיקה', () => {
    assert.equal(isDue(undefined, NOW), false);
    assert.equal(isDue(null, NOW), false);
    assert.equal(isDue(Number.NaN, NOW), false);
    assert.equal(isDue('2026-01-01', NOW), false);
  });
});

describe('המעברים', () => {
  it('סגירה סוגרת, ואינה נוגעת בבקשת מחיקה', () => {
    assert.deepEqual(planAction('close', { hasRequest: false }), { isActive: false, request: null });
  });

  it('פתיחה מחדש פותחת', () => {
    assert.deepEqual(planAction('reopen', { hasRequest: false }), { isActive: true, request: null });
  });

  it('⚠️⚠️ סלון שמתוזמן למחיקה אינו נפתח לפני שמבטלים את המחיקה', () => {
    // אחרת חברים משתבצים בו, ואז הוא נמחק עם השיבוצים שלהם.
    assert.deepEqual(planAction('reopen', { hasRequest: true }), { error: 'deletionScheduled' });
  });

  it('⚠️ תזמון מחיקה סוגר את הסלון מיד', () => {
    assert.deepEqual(planAction('scheduleDeletion', { hasRequest: false }), {
      isActive: false,
      request: 'create',
    });
  });

  it('אין שתי בקשות מחיקה לאותו סלון', () => {
    assert.deepEqual(planAction('scheduleDeletion', { hasRequest: true }), { error: 'alreadyScheduled' });
  });

  it('⚠️ ביטול המחיקה מוחק את הבקשה, והסלון נשאר סגור', () => {
    assert.deepEqual(planAction('cancelDeletion', { hasRequest: true }), {
      isActive: undefined,
      request: 'delete',
    });
  });

  it('אין מה לבטל כשאין בקשה', () => {
    assert.deepEqual(planAction('cancelDeletion', { hasRequest: false }), { error: 'notScheduled' });
  });

  it('פעולה שאינה ברשימה נדחית', () => {
    assert.deepEqual(planAction('deleteNow', { hasRequest: false }), { error: 'badAction' });
    assert.equal(ACTIONS.includes('deleteNow'), false);
  });
});

describe('מזהה הסלון', () => {
  it('מזהה תקין עובר', () => {
    assert.ok(BRANCH_ID.test('tel-aviv'));
  });

  it('⚠️ נתיב אינו מזהה', () => {
    // בלי זה `branchId: 'x/members/y'` היה מכוון את המחיקה למסמך אחר.
    assert.equal(BRANCH_ID.test('tel-aviv/members/x'), false);
    assert.equal(BRANCH_ID.test('../platformAdmins'), false);
    assert.equal(BRANCH_ID.test(''), false);
  });
});
