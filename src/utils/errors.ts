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

  // ⚠️ וכל השאר אינו מוחזר כלשונו. הוא הולך לקונסולה, והמשתמש מקבל משפט
  // שאומר לו מה לעשות.
  if (import.meta.env.DEV) console.error('[salon]', error);
  return fallback;
}
