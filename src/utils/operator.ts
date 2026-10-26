// src/utils/operator.ts
//
// ⚠️⚠️ מפעיל המערכת, קשיח לכתובת מייל.
//
// בהכרעת בעל המוצר, 26/10/2026: *"לא לא, זה צריך להיות רק קשיח לכתובת מייל
// שלי מבחינתי מספיק שבמסד זה עובד"*.
//
// ⚠️⚠️ ומה שכאן אינו ההגנה. ההגנה יושבת ב-`firestore.rules`, ואותה כתובת
// מופיעה שם. כאן היא משמשת כדי שלא יוצג כפתור שתמיד ייכשל, וזה הכול.
// DOCS/PLANING/40-the-system-operator-can-be-demoted.md

import type { Member } from '../types';

/** ⚠️ אותה כתובת בדיוק כמו ב-`firestore.rules`. שינוי באחת בלי השנייה פותח פער. */
export const OPERATOR_EMAIL = 'chagai33@gmail.com';

export function isSystemOperator(member: Pick<Member, 'email'>): boolean {
  return member.email === OPERATOR_EMAIL;
}
