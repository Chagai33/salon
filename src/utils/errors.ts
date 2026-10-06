// src/utils/errors.ts
//
// ⚠️ שגיאת Firebase גולמית אינה מגיעה לדפדפן.
// DOCS/PLANING/03-the-design-standard.md, סעיף הודעות כשל.
//
// "Missing or insufficient permissions" הופיע במסך למשתמש, באנגלית, וזה בדיוק
// מה שהכלל אוסר. הודעה אומרת מה נעשה, מה נכשל במונחי הקורא, ומה אפשר לעשות
// עכשיו. ונעצרת.

import { t } from '../i18n/dictionary';

interface MaybeFirebaseError {
  code?: unknown;
  message?: unknown;
}

function codeOf(error: unknown): string {
  const candidate = error as MaybeFirebaseError;
  if (typeof candidate?.code === 'string') return candidate.code;
  if (typeof candidate?.message === 'string') return candidate.message;
  return '';
}

/**
 * מתרגם שגיאה להודעה שהמשתמש יכול לקרוא.
 *
 * @param fallback מה לומר כשאין התאמה. לכל קורא יש הקשר משלו, ולכן אין ברירת
 *                 מחדל גנרית אחת.
 */
export function toReadableError(error: unknown, fallback: string): string {
  const code = codeOf(error);

  // ⚠️ הרשאות. זו השגיאה היחידה שמשמעותה שונה לגמרי למשתמש ולמפתח:
  // המשתמש לא עשה כלום רע, והמסד פשוט לא מוגדר עוד.
  if (code.includes('permission-denied') || code.includes('insufficient permissions')) {
    return t.errors.permissions;
  }

  if (code.includes('unavailable') || code.includes('network')) {
    return t.errors.offline;
  }

  if (code.includes('unauthenticated')) {
    return t.errors.signedOut;
  }

  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
    return t.errors.popupClosed;
  }

  if (code.includes('popup-blocked')) {
    return t.errors.popupBlocked;
  }

  // שתי אלה נזרקות מתוך שכבת השירות, לפני שנגעו במסד.
  if (code.includes('badBranchId')) return t.errors.badBranchId;
  if (code.includes('branchExists')) return t.errors.branchExists;

  /*
    ⚠️⚠️ וכל השאר מוחזר עם הפרט האמיתי, ולא כמשפט גנרי לבדו.

    בלשון בעל המוצר, 06/10: "אם לא בוצעה שמירה מכל סיבה חובה לספק למשתמש את
    השגיאה האמיתית ולא שגיאות גנריות, וזה נכון לכל האפליקציה".

    ⚠️ והמשפט בעברית נשאר ראשון, כי הוא מה שאומר מה לעשות. הפרט בא אחריו,
    והוא מה שמאפשר לדווח על התקלה. DOCS/PLANING/26
  */
  if (import.meta.env.DEV) console.error('[salon]', error);

  const detail = detailOf(error);
  return detail ? `${fallback} (${detail})` : fallback;
}

/** הפרט הטכני, מקוצר. ⚠️ ואינו מחליף את המשפט בעברית, הוא נוסף לו. */
function detailOf(error: unknown): string {
  const candidate = error as MaybeFirebaseError;
  const parts: string[] = [];
  if (typeof candidate?.code === 'string' && candidate.code) parts.push(candidate.code);
  if (typeof candidate?.message === 'string' && candidate.message) {
    const message = candidate.message.trim();
    // ⚠️ הודעה ארוכה נחתכת. המסך אינו יומן.
    parts.push(message.length > 160 ? `${message.slice(0, 160)}…` : message);
  }
  if (parts.length === 0 && typeof error === 'string') parts.push(error);
  // ⚠️ כפילות: Firebase כותב את הקוד גם בתוך ההודעה.
  return [...new Set(parts)].join(' · ');
}
