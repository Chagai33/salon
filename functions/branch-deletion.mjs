// functions/branch-deletion.mjs
//
// ⚠️⚠️ סגירה ומחיקה של סלון. DOCS/PLANING/35-there-is-no-way-to-delete-a-salon.md
//
// בהכרעת בעל המוצר 12/10: "אני רוצה גם אפשרות למחוק סלון אבל שהמחיקה תתבצע
// בפועל אחרי 30 יום", ובהכרעה 2 א: סגירה הפיכה שמשאירה את המידע.
//
// ⚠️ וההיגיון כאן ולא ב-index.mjs, מאותה סיבה כמו admin-app.mjs: index.mjs
// מצהיר טריגרים, ואי אפשר לייבא אותו בבדיקה בלי לטעון אותם.
// test/functions/branch-deletion.test.mjs

/** ⚠️ 30 יום, בהכרעת בעל המוצר 12/10. */
export const DELETION_DAYS = 30;

const DAY_MS = 86_400_000;

export const ACTIONS = ['close', 'reopen', 'scheduleDeletion', 'cancelDeletion'];

/** ⚠️ אותה תבנית כמו `BRANCH_ID_PATTERN` בדפדפן. המזהה יושב בנתיב במסד. */
export const BRANCH_ID = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$/;

/**
 * מתי הסלון יימחק.
 *
 * ⚠️⚠️ מהשעון של השרת, ולא ממה שהדפדפן שלח. תאריך שמגיע מהדפדפן הוא תאריך
 * שאפשר לכתוב אחורה, ואז "בעוד 30 יום" הוא "עכשיו".
 */
export function deleteAfterFrom(nowMs) {
  return nowMs + DELETION_DAYS * DAY_MS;
}

/** האם הגיע הזמן. ⚠️ ערך שאינו מספר אינו "הגיע", כדי שבאג לא יהפוך למחיקה. */
export function isDue(deleteAfterMs, nowMs) {
  return Number.isFinite(deleteAfterMs) && deleteAfterMs <= nowMs;
}

/**
 * מה פעולה עושה, בהינתן המצב.
 *
 * @returns `{ error }`, או `{ isActive, request }`. `isActive` הוא הערך החדש
 *          של הסלון, או undefined כשאינו משתנה. `request` הוא 'create', 'delete'
 *          או null, ומדבר על בקשת המחיקה.
 */
export function planAction(action, { hasRequest }) {
  switch (action) {
    case 'close':
      return { isActive: false, request: null };
    case 'reopen':
      // ⚠️ סלון שמתוזמן למחיקה אינו נפתח לפני שמבטלים את המחיקה. אחרת הוא
      // פתוח, חברים משתבצים בו, ואז הוא נמחק עם השיבוצים שלהם.
      if (hasRequest) return { error: 'deletionScheduled' };
      return { isActive: true, request: null };
    case 'scheduleDeletion':
      if (hasRequest) return { error: 'alreadyScheduled' };
      // ⚠️ ונסגר מיד. 30 הימים הם זמן להתחרט, ולא עוד חודש של פעילות.
      return { isActive: false, request: 'create' };
    case 'cancelDeletion':
      if (!hasRequest) return { error: 'notScheduled' };
      // ⚠️ ונשאר סגור. ביטול המחיקה אינו פתיחה, והפתיחה היא פעולה נפרדת.
      return { isActive: undefined, request: 'delete' };
    default:
      return { error: 'badAction' };
  }
}
