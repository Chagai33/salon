// functions/eligibility.mjs
//
// ⚠️⚠️ אזור ליבה. CLAUDE.md.
// קוד שנחשף לחבר שאינו זכאי הוא כשל במוצר, וזה הקובץ שמחליט.
//
// ⚠️ וזהו העתק של `src/utils/eligibility.ts`, בכוונה ובלי שינוי בחישוב.
// הדפדפן ממשיך להחליט מה להציג, וכאן מוחלט מה בכלל נשלח אליו. שני העותקים
// חייבים לומר אותו דבר, ולכן כל שינוי באחד הוא שינוי בשני.
//
// ⚠️⚠️ והבדל אחד קיים, ובכוונה: החודש הנוכחי. בדפדפן הוא אזור הזמן של
// המשתמש, וכאן הוא נקבע בשעון ישראל, כי הפונקציה רצה ב-us-central1. הוא
// נוגע ל-`codeIsStale` בלבד, ולא לזכאות.
// DOCS/PLANING/15-the-code-is-not-enforced-yet.md
//
// ⚠️ וההיגיון כאן ולא ב-index.mjs, מאותה סיבה כמו branch-deletion.mjs:
// index.mjs מצהיר טריגרים, ואי אפשר לייבא אותו בבדיקה בלי לטעון אותם.
// test/functions/eligibility.test.mjs

/** ⚠️ שעון ישראל ולא שעון השרת. הפונקציה רצה ב-us-central1. */
export const TIME_ZONE = 'Asia/Jerusalem';

/** `2026-10` מתוך `2026-10-04`. */
export function monthKeyOfDateKey(dateKey) {
  return String(dateKey ?? '').slice(0, 7);
}

/**
 * החודש שהשרת נמצא בו, בשעון ישראל.
 *
 * ⚠️ `en-CA` ולא בנייה ידנית: `new Date()` בפונקציה הוא UTC, ובלילה שבין
 * האחרון בחודש לראשון בו שני השעונים אינם מסכימים על החודש.
 */
export function monthKeyNow(now = Date.now(), timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(now));
}

/** גבולות החודש כמפתחות תאריך, לשאילתה על `date`. */
export function monthBounds(monthKey) {
  return { from: `${monthKey}-01`, to: `${monthKey}-31` };
}

/**
 * האם החבר זכאי לקוד בחודש נתון.
 *
 * ⚠️ אותן שתי הדרכים כמו בדפדפן, ולא אחת: משמרת שהוא מחזיק, או משמרת שהוא
 * מסר בהחלפה שהושלמה. DOCS/PLANING/10-shift-handover.md
 */
export function eligibilityFor(shifts, memberId, monthKey) {
  const inMonth = shifts.filter((shift) => monthKeyOfDateKey(shift.date) === monthKey);

  const held = inMonth.filter((shift) => shift.assigneeMemberId === memberId);
  if (held.length > 0) {
    return {
      isEligible: true,
      reason: 'assigned',
      periodMonth: monthKey,
      shiftDates: held.map((shift) => shift.date).sort(),
    };
  }

  /*
    ⚠️⚠️ ו-`handoverFromMemberId` לבדו, בלי `handoverState`. התנאי על המצב
    היה כאן ונמחק: הוא חוזר ל-`none` כשהמקבל משחרר, ול-`requested` כשהוא
    מבקש מחליף בעצמו, ובשני המצבים מי שמסר את המשמרת איבד את הזכאות שלו
    בשקט. בהכרעת בעל המוצר 26/10/2026, בלשונו *"4א"*.

    ⚠️ וזה אותו שינוי בדיוק כמו ב-`src/utils/eligibility.ts`, שורה מול שורה.
    DOCS/PLANING/10-shift-handover.md
  */
  const handedOver = inMonth.filter((shift) => shift.handoverFromMemberId === memberId);
  if (handedOver.length > 0) {
    return {
      isEligible: true,
      reason: 'handedOver',
      periodMonth: monthKey,
      shiftDates: handedOver.map((shift) => shift.date).sort(),
    };
  }

  return { isEligible: false, reason: 'none', periodMonth: monthKey, shiftDates: [] };
}

/** הקוד הנוכחי: האחרון שהוגדר ואינו בעתיד. */
export function currentCode(codes, now = Date.now()) {
  const live = codes
    .filter((code) => code.validFrom <= now)
    .sort((a, b) => b.validFrom - a.validFrom);
  return live[0] ?? null;
}

/**
 * התשובה שנשלחת לדפדפן.
 *
 * ⚠️⚠️ וזו כל הנקודה של הסבב הזה: `code` הוא מחרוזת רק כשהחבר זכאי, ובכל
 * מצב אחר הוא `null`. מה שלא נשלח אינו נקרא בכלי פיתוח.
 *
 * ⚠️ ו-`hasCode` נשלח בלי קשר לזכאות, כי "אין קוד" ו"יש קוד ואינך זכאי" הם
 * שני מסכים שונים לחבר, ואין בו עצמו שום סוד.
 */
export function codeAnswerFor(shifts, codes, memberId, now = Date.now()) {
  const code = currentCode(codes, now);
  const thisMonth = monthKeyNow(now);
  const period = code?.periodMonth ?? thisMonth;
  const eligibility = eligibilityFor(shifts, memberId, period);

  return {
    hasCode: Boolean(code),
    code: code && eligibility.isEligible ? code.code : null,
    periodMonth: period,
    isEligible: eligibility.isEligible,
    reason: eligibility.reason,
    shiftDates: eligibility.shiftDates,
    codeIsStale: Boolean(code) && period < thisMonth,
  };
}
