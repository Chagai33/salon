// src/utils/eligibility.ts
//
// ⚠️ אזור ליבה. CLAUDE.md.
// קוד שנחשף לחבר שאינו זכאי הוא כשל במוצר, ומה שנראה ידוע ואינו נשכח.
//
// ההכרעות שמיושמות כאן, DOCS/PLANING/02-the-data-model.md:
//
//   1. השיבוץ מזכה. הנוכחות נמדדת ואינה מזכה.
//      "שיבוץ לזכאות, משמרת שהתקיימה זה לדוחות."
//
//   2. מי שמצא מחליף שומר על הזכאות שלו.
//
//   3. הזכאות חודשית יחד עם הקוד, והחודש של הקוד נגזר מ-validFrom.
//      "אין טריגר בהכרח שהמנהלות יחליפו את הקוד ב-1 לחודש ולא ב-2."
//
// ⚠️ ואין שדה זכאות שנשמר, בכוונה. זכאות שנשמרת היא זכאות שיכולה להתיישן,
// וחבר שביטל משמרת והשדה לא התעדכן הוא חבר שרואה קוד שאינו שלו.

import type { AccessCode, EligibilityResult, Shift } from '../types';
import { monthKeyOfDateKey, toMonthKey } from './dates';

/**
 * האם החבר זכאי לקוד בחודש נתון.
 *
 * @param shifts   משמרות הסניף. אין צורך לסנן לחודש מראש.
 * @param memberId החבר הנבדק.
 * @param monthKey `2026-10`.
 */
export function eligibilityFor(
  shifts: Shift[],
  memberId: string,
  monthKey: string,
): EligibilityResult {
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

  // החצי השני של הנוסחה: מי שמסר משמרת ומישהו לקח אותה.
  // ⚠️ רק handoverState שהוא completed. בקשה שלא נענתה אינה מזכה, והאחריות
  // נשארת על המבקש. DOCS/PLANING/10-shift-handover.md
  const handedOver = inMonth.filter(
    (shift) => shift.handoverFromMemberId === memberId && shift.handoverState === 'completed',
  );
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
export function currentCode(codes: AccessCode[], now: number = Date.now()): AccessCode | null {
  const live = codes
    .filter((code) => code.validFrom <= now)
    .sort((a, b) => b.validFrom - a.validFrom);
  return live[0] ?? null;
}

/** `2026-10` מתוך חותמת זמן. זה מה שנכתב ל-periodMonth בשעת הגדרת הקוד. */
export function periodMonthOf(validFrom: number): string {
  return toMonthKey(new Date(validFrom));
}

export interface CodeVisibility {
  /** האם להציג את הקוד עצמו. */
  canSee: boolean;
  code: AccessCode | null;
  eligibility: EligibilityResult;
  /**
   * ⚠️ המנהלת דילגה על חודש: הקוד הנוכחי שייך לחודש קודם.
   * התוצאה היא חברים זכאים בלי קוד, וזה מצב שצריך להתריע עליו ולא להסתיר.
   */
  codeIsStale: boolean;
}

/**
 * מה החבר רואה במסך הקוד.
 *
 * ⚠️ הבדיקה היא מול `periodMonth` של הקוד ולא מול החודש הנוכחי. כך קוד שהוגדר
 * ב-2 באוקטובר הוא "הקוד של אוקטובר", וחבר ששמר ב-1 באוקטובר זכאי לו.
 */
export function codeVisibilityFor(
  shifts: Shift[],
  codes: AccessCode[],
  memberId: string,
  now: number = Date.now(),
): CodeVisibility {
  const code = currentCode(codes, now);
  const thisMonth = toMonthKey(new Date(now));
  const period = code?.periodMonth ?? thisMonth;
  const eligibility = eligibilityFor(shifts, memberId, period);

  return {
    canSee: Boolean(code) && eligibility.isEligible,
    code,
    eligibility,
    codeIsStale: Boolean(code) && period < thisMonth,
  };
}

/**
 * מדרגת הפעילות של חבר.
 *
 * בהכרעת בעל המוצר: פעיל הוא מי שיש לו משמרת בחודש הנבדק, מדשדש הוא מי שהיה
 * בשלושת החודשים האחרונים ולא בחודש הנבדק, ורדום הוא מי שלא היה שלושה חודשים.
 */
export function activityTierFor(
  shifts: Shift[],
  memberId: string,
  monthKey: string,
): 'active' | 'lukewarm' | 'dormant' {
  const mine = shifts.filter(
    (shift) => shift.assigneeMemberId === memberId || shift.handoverFromMemberId === memberId,
  );
  const months = new Set(mine.map((shift) => monthKeyOfDateKey(shift.date)));

  if (months.has(monthKey)) return 'active';

  const [year, month] = monthKey.split('-').map(Number);
  for (let back = 1; back <= 2; back += 1) {
    const date = new Date(year, month - 1 - back, 1);
    if (months.has(toMonthKey(date))) return 'lukewarm';
  }
  return 'dormant';
}
