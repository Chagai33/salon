// src/utils/times.ts
//
// שעות היום, כמחרוזות `HH:MM`, והשוואות ביניהן.
//
// ⚠️⚠️ ואירוע שנגמר לפני שהתחיל אינו שגיאה תמיד.
//
// בלשון בעל המוצר, 26/10/2026: "אם אירוע מתחיל ב 19 אז לא להציע זמן לסיום שהוא
// לפני 19 זה היגיון בסיסי". ⚠️ **ובאותו יום הוא גם אמר "יש אירועים כאלה - נא
// לאפשר תמיכה"** על אירוע שחוצה חצות. DOCS/PLANING/42
//
// ⚠️⚠️ ולכן חציית חצות אינה מוסקת מהמספרים אלא מסומנת.
// אירוע 23:00 עד 01:00 ואירוע 19:00 עד 18:00 נראים אותו דבר בהשוואת שעות, והאחד
// חוקי והשני הוא בדיוק הטעות שהבקשה באה למנוע. סימון "ממשיך למחרת" הוא מה שמבדיל
// ביניהם, וההסקה הייתה הופכת טעות בן 23 שעות לאירוע חוקי.

/** ⚠️ הפורמט היחיד שנשמר במסד. כל השאר נזרק לפני השמירה. */
const TIME = /^\d{2}:\d{2}$/;

/** דקות מחצות. ⚠️ `undefined` ולא אפס כששעה חסרה: אפס הוא חצות. */
export function minutesOf(time: string | undefined): number | undefined {
  if (!time || !TIME.test(time)) return undefined;
  const [hours, minutes] = time.split(':').map(Number);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/** דקות מחצות אל `HH:MM`. ⚠️ `undefined` כשהתוצאה נופלת לפני חצות. */
export function timeOf(minutes: number): string | undefined {
  if (minutes < 0 || minutes > 23 * 60 + 59) return undefined;
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** ⚠️ אותו יום בלבד. שעה פחות דקות שיוצאת לפני חצות מחזירה `undefined`. */
export function minusMinutes(time: string | undefined, minutes: number): string | undefined {
  const base = minutesOf(time);
  return base === undefined ? undefined : timeOf(base - minutes);
}

/**
 * האם האירוע נגמר לפני שהתחיל, או באותו רגע.
 *
 * ⚠️ אירוע בלי שתי השעות אינו נבדק. שדה ריק אינו שגיאה, והמנהלת ממלאת אותו
 * בסדר שלה.
 *
 * ⚠️⚠️ ו-`endsNextDay` משחרר את הבדיקה לגמרי, ואינו מוסק משום דבר.
 */
export function endsBeforeStart(
  startTime: string | undefined,
  endTime: string | undefined,
  endsNextDay?: boolean,
): boolean {
  if (endsNextDay) return false;
  const start = minutesOf(startTime);
  const end = minutesOf(endTime);
  if (start === undefined || end === undefined) return false;
  return end <= start;
}

/**
 * האם שעת הסגירה המוקדמת יושבת מחוץ לשעות הפתיחה של אותו יום.
 *
 * ⚠️ נכתב בגלל מה שנמדד ברשומה 42: השדה היה חופשי, **ואפשר היה לקבוע שהסלון
 * נסגר מוקדם ב-23:00 בסלון שסוגר ב-22:00.** סגירה מוקדמת שאינה מוקדמת אינה
 * סגירה מוקדמת.
 *
 * ⚠️ ויום בלי שעות פתיחה, כמו שישי, אינו נבדק. אין מול מה.
 */
export function closesOutsideHours(
  closesAt: string | undefined,
  hours: { open: string; close: string } | null | undefined,
): boolean {
  if (!hours) return false;
  const at = minutesOf(closesAt);
  const open = minutesOf(hours.open);
  const close = minutesOf(hours.close);
  if (at === undefined || open === undefined || close === undefined) return false;
  return at < open || at >= close;
}
