// functions/board-image.mjs
//
// החלקים הטהורים של קריאת תמונת הלוח: ההנחיה, הסכימה, והסינון של התשובה.
//
// ⚠️ מופרדים מהפונקציה כדי שאפשר יהיה לבדוק אותם בלי רשת ובלי מפתח.
// הסינון הוא מה שמגן על המסד מתשובה שהמודל החזיר לא לפי ההנחיה, והוא בדיוק
// מה שחייב להיבדק.

/**
 * ⚠️ המודל. `gemini-2.5` נסגר ב-16/10/2026, ולכן הוא אינו כאן.
 * `gemini-3.8-flash` הוא מה שגוגל ממליצה לפרויקט חדש, והוא מקבל תמונה.
 */
export const MODEL = 'gemini-3.8-flash';

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** ⚠️ עשרה מגה. ההגבלה כאן היא מפני קלט מופרך, ולא מפני זמן. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * ⚠️ ההנחיה למודל, והיא עיקר הדיוק כאן.
 *
 * ⚠️⚠️ **והיא מצטמצמת ואינה גדלה, בהכרעת בעל המוצר 27/10/2026.**
 *
 * בלשונו: "זה מודל שאמור להבין ממש בקלות כמה אירועים יש לא משנה אם זו טבלה או
 * התמונה המקורית של לוח חודשי עם אירועים. מה הבעיה להנחות אותו להבין כמה
 * אירועים ומה הפרטים שלהם וזהו."
 *
 * **מה שהיה, ונמדד:** 2,199 תווים. **שתי הפעמים שנגעו בה הוסיפו לה תיאור
 * וכללים**, ובה היו תיאור עמודות לוח, שורה שלמה מתמונה אחת של בעל המוצר,
 * מספר השורות המדויק שלה, שני שמות החללים שבה, כלל שמורה להתעלם מכותרת,
 * וסינון חודש. ⚠️ **והקריאה החזירה אירוע אחד מתוך שלושה עשר בשתי הגרסאות**,
 * וזו מדידה ולא השערה. DOCS/PLANING/57
 *
 * **ועכשיו 812 תווים.** ⚠️ **ומה שיוצא ממנה אינו חוזר:** דוגמה שלקוחה ממקור
 * מסוים מתארת למודל פריט אחד ומבקשת ממנו להכליל ממנו.
 *
 * ⚠️⚠️ **ושני כללים אינם זזים, כי הייבוא הוא אזור ליבה לפי `CLAUDE.md`:**
 * "אל תחזיר שמות של אנשים", ו-`access` שהוא `unknown` כברירת מחדל. **שתי
 * בדיקות נועלות אותם בשמם.**
 *
 * ⚠️ **והחודש אינו כאן.** הוא עניין של האפליקציה: היא משלימה את השנה והיא
 * שמפרידה בין החודש שנבחר לחודש אחר. **ובנוסח הקודם הוא היה הוראה לסנן
 * שניתנה למודל, וזה גם מה שגרם ל-164 שניות המתנה.**
 *
 * ⚠️ ואותה הנחיה משרתת תמונה וטקסט. המקור משתנה, ומה שצריך לחזור ממנו לא.
 */
export function promptFor() {
  return [
    'המקור הוא לוח האירועים של מרחב עבודה משותף.',
    'החזר כל יום שיש בו אירוע, ולכל יום את כל האירועים שבו.',
    '',
    'לכל יום: התאריך, והאירועים שבו.',
    'לכל אירוע: שם, שעת התחלה, שעת סיום, ושם החלל שבו הוא מתקיים.',
    '',
    'כללים:',
    '1. תאריך כפי שהוא כתוב במקור, ועם השנה אם היא כתובה.',
    '2. שעות בפורמט HH:MM.',
    '   ואם שעת הסיום מוקדמת משעת ההתחלה, האירוע ממשיך למחרת:',
    '   החזר endsNextDay אמת, ואל תתקן את השעות.',
    '3. אל תחזיר שמות של אנשים, גם אם הם מופיעים במקור.',
    '4. `access` הוא "unknown" כברירת מחדל, וזו התשובה הנכונה כמעט תמיד.',
    '   החזר open, membersOnly או closed רק אם כתוב על אותו יום במפורש שהמרחב',
    '   פתוח, פתוח לחברים בלבד, או סגור. שעות פתיחה כלליות בראש המקור או',
    '   בתחתיתו אינן מידע על יום מסוים, ואינן סיבה להחזיר open.',
    '5. `note` הוא מה שכתוב על היום ואינו אירוע, למשל שם חג.',
    '6. `confidence` הוא 0 עד 1, ומבטא כמה הקריאה של אותו יום ברורה.',
  ].join('\n');
}

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING' },
          note: { type: 'STRING' },
          /* ⚠️ `unknown` ראשון בכוונה, והוא התשובה הנכונה כמעט תמיד. */
          access: { type: 'STRING', enum: ['unknown', 'open', 'membersOnly', 'closed'] },
          events: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                startTime: { type: 'STRING' },
                endTime: { type: 'STRING' },
                /* ⚠️ אירוע שממשיך למחרת, 23:00 עד 01:00. DOCS/PLANING/42 */
                endsNextDay: { type: 'BOOLEAN' },
                /*
                  ⚠️⚠️ שם החלל כפי שהוא כתוב במקור, ולא מזהה.
                  החלל במוצר הוא ישות עם מזהה על הסניף, והמודל אינו יכול
                  לדעת אותו. ⚠️ ולכן זו מחרוזת, והמסך הוא שמתאים אותה
                  לרשימת החללים של הסלון. DOCS/PLANING/52
                */
                space: { type: 'STRING' },
              },
              required: ['title'],
            },
          },
          confidence: { type: 'NUMBER' },
        },
        required: ['date', 'access', 'confidence'],
      },
    },
  },
  required: ['days'],
};

/**
 * מסנן את תשובת המודל.
 *
 * ⚠️ סכימה אינה הבטחה. המודל יכול להחזיר תאריך מחודש אחר, שעה בפורמט אחר,
 * או שלושים אירועים ליום אחד, למרות שההנחיה אמרה אחרת. הסינון הוא מה שעומד
 * בין התשובה ובין המסד.
 */
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
/** `3.11`, `3/11`, `3-11`, ועם שנה בת שתי ספרות או ארבע. */
const LOOSE = /^(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2}|\d{4}))?$/;

function pad(number) {
  return String(number).padStart(2, '0');
}

/** ⚠️ תאריך שאינו קיים, כמו 31 בפברואר, אינו תאריך. */
function isoOf(year, month, day) {
  if (!(year >= 2000 && year <= 2100)) return undefined;
  if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * ⚠️⚠️ תאריך כפי שהמודל קרא אותו, אל תאריך של המוצר.
 *
 * **המודל מחזיר את מה שכתוב במקור**, ובמקורות אמיתיים התאריך כתוב לרוב בלי
 * שנה: `3.11`. ⚠️ **והאפליקציה היא שמשלימה**, בהכרעת בעל המוצר 27/10/2026.
 * **ובהנחיה אין כלל שנה**, כי כלל כזה הוא עוד תיאור שהמודל אינו צריך.
 *
 * ⚠️ **והשנה נבחרת מבין שלוש, הקרובה לחודש שנבחר.** בלי זה `3.1` בייבוא של
 * דצמבר היה נופל לינואר שעבר. DOCS/PLANING/57
 *
 * ⚠️ ושנה שכתובה במקור מנצחת תמיד.
 */
export function isoDateOf(raw, monthKey) {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim();

  const iso = ISO.exec(text);
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const loose = LOOSE.exec(text);
  if (!loose) return undefined;

  const day = Number(loose[1]);
  const month = Number(loose[2]);
  if (loose[3]) {
    const written = Number(loose[3]);
    return isoOf(loose[3].length === 2 ? 2000 + written : written, month, day);
  }

  const [selectedYear, selectedMonth] = String(monthKey ?? '').split('-').map(Number);
  if (!Number.isFinite(selectedYear) || !Number.isFinite(selectedMonth)) return undefined;

  let best;
  for (const year of [selectedYear - 1, selectedYear, selectedYear + 1]) {
    const candidate = isoOf(year, month, day);
    if (!candidate) continue;
    const distance = Math.abs(year * 12 + month - (selectedYear * 12 + selectedMonth));
    if (!best || distance < best.distance) best = { candidate, distance };
  }
  return best?.candidate;
}

export function sanitiseDays(parsed, monthKey) {
  const days = Array.isArray(parsed?.days) ? parsed.days : [];

  return days
    /*
      ⚠️⚠️ ואינה מסננת לחודש אחד עוד, בהכרעת בעל המוצר 27/10/2026.

      **הסינון היה הוראה שניתנה למודל**, "והחזר אותו רק אם החודש שבו תואם",
      ⚠️ **וגם הוא וגם הסינון כאן מחקו מה שהמנהלת העלתה.** עכשיו הכול חוזר,
      **והאפליקציה מפרידה בין החודש שנבחר לחודש אחר ומציעה לעבור.**
      DOCS/PLANING/57
    */
    .map((day) => ({ ...day, date: isoDateOf(day?.date, monthKey) }))
    .filter((day) => typeof day.date === 'string')
    /* ⚠️ שישים ושניים ולא שלושים ואחד: שני חודשים הם מקרה חוקי עכשיו. */
    .slice(0, 62)
    .map((day) => ({
      date: day.date,
      note: typeof day.note === 'string' ? day.note.slice(0, 100) : '',
      /*
        ⚠️⚠️ `unknown` ולא `open`.
        בלוח אירועים אין שום מידע על מי סגור למי, ולכן ברירת מחדל `open`
        הייתה חותמת "פתוח לכולם" על כל יום שנקרא, כולל שישי ושבת, ומוחקת
        בשקט את כלל סוף השבוע ואת מה שהמנהלת הגדירה.
      */
      access: ['open', 'membersOnly', 'closed'].includes(day.access) ? day.access : 'unknown',
      events: Array.isArray(day.events)
        ? day.events
            .filter((event) => typeof event?.title === 'string' && event.title.trim())
            .slice(0, 6)
            .map((event) => ({
              title: String(event.title).trim().slice(0, 80),
              ...(/^\d{2}:\d{2}$/.test(event.startTime ?? '')
                ? { startTime: event.startTime }
                : {}),
              ...(/^\d{2}:\d{2}$/.test(event.endTime ?? '') ? { endTime: event.endTime } : {}),
              /*
                ⚠️ אמת בלבד, ולא `false`.
                `false` היה נשלח למסד כשדה מיותר על כל אירוע, ⚠️ והוא גם היה
                נכנס למפתח ההשוואה של `importDiff` ומסמן ימים זהים כשונים.
                DOCS/PLANING/42
              */
              ...(event.endsNextDay === true ? { endsNextDay: true } : {}),
              /*
                ⚠️ שם החלל, חתוך ל-40 תווים כמו השדה שהמנהלת מקלידה בו.
                ⚠️⚠️ ומחרוזת ריקה אינה נשלחת: היא הייתה מגיעה למסך כחלל שאין
                לו שם, ונראית כמו קריאה שנכשלה. DOCS/PLANING/52
              */
              ...(typeof event.space === 'string' && event.space.trim()
                ? { space: event.space.trim().slice(0, 40) }
                : {}),
            }))
        : [],
      confidence: typeof day.confidence === 'number' ? day.confidence : 0,
    }))
    // ⚠️ יום בלי אירוע, בלי הערה ובלי מצב גישה אינו מידע. הוא רק מספר בלוח.
    .filter((day) => day.events.length > 0 || day.note || day.access !== 'unknown');
}

/**
 * ⚠️⚠️ מה המודל החזיר, במספרים, ולפני שהסינון נגע בתשובה.
 *
 * **נכתב כי אין על זה תשובה, וממנה הכול נגזר.** נמדד בלוג 27/10/2026 שתמונה
 * של טבלה בת 13 שורות מחזירה יום אחד, **והלוג סופר ימים אחרי הסינון.**
 * ⚠️ **ולכן אי אפשר לדעת אם המודל החזיר 13 ו-12 נפלו בסינון החודש, או שהחזיר
 * אחד.** אלה שתי בעיות שונות לגמרי, ולכל אחת תיקון אחר.
 * DOCS/PLANING/57
 *
 * ⚠️⚠️ **ומספרים בלבד, בלי שמות ובלי תוכן אירועים.** הייבוא הוא אזור ליבה
 * לפי `CLAUDE.md`, והלוג אינו מקום לתוכן שנקרא מתמונה של אנשים אמיתיים.
 * **וחודש אינו מידע אישי**, והוא בלוג ממילא.
 *
 * ⚠️ והיא טהורה ואינה נוגעת בתשובה, ולכן `sanitiseDays` לא נגעה.
 */
export function inspectDays(parsed, monthKey) {
  const days = Array.isArray(parsed?.days) ? parsed.days : [];
  /* ⚠️ ומנורמל, כמו בסינון, אחרת `3.11` נספר כתאריך שאינו קריא. */
  const dated = days
    .map((day) => isoDateOf(day?.date, monthKey))
    .filter((date) => typeof date === 'string');
  const inMonth = dated.filter((date) => date.startsWith(`${monthKey}-`));

  /* ⚠️ אילו חודשים המודל קרא בפועל. זו התשובה ל"האם הוא בכלל ראה את הלוח". */
  const months = [...new Set(dated.map((date) => date.slice(0, 7)))].sort().slice(0, 12);

  /* ⚠️ כמה אירועים נשאו כותרת, ⚠️ והכותרות עצמן אינן נספרות ואינן נרשמות. */
  const events = days.reduce(
    (total, day) =>
      total +
      (Array.isArray(day?.events)
        ? day.events.filter((event) => typeof event?.title === 'string' && event.title.trim())
            .length
        : 0),
    0,
  );

  return {
    returned: days.length,
    badDate: days.length - dated.length,
    /*
      ⚠️ ומ-27/10 `wrongMonth` אינו "כמה נמחקו" אלא "כמה שייכים לחודש אחר".
      הם כן מגיעים לדפדפן עכשיו, והמסך מציע לעבור אליהם. DOCS/PLANING/57
    */
    wrongMonth: dated.length - inMonth.length,
    /* ⚠️ ועל כל הימים, כי התקרה אינה לחודש אחד עוד. */
    overflow: Math.max(0, dated.length - 62),
    kept: sanitiseDays(parsed, monthKey).length,
    events,
    months,
  };
}

/*
  ⚠️ מה שזהה לשני המקורות: הסכימה, וטמפרטורה אפס.
  קריאת לוח אינה יצירתיות, ואותו מקור צריך לתת אותה תשובה.
*/
const GENERATION_CONFIG = {
  response_mime_type: 'application/json',
  response_schema: SCHEMA,
  temperature: 0,
};

/** בונה את גוף הבקשה ל-Gemini, לתמונה. מופרד כדי שאפשר יהיה לבדוק אותו. */
export function requestBodyFor(mimeType, imageBase64) {
  return {
    contents: [
      {
        parts: [
          { text: promptFor() },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: GENERATION_CONFIG,
  };
}

/**
 * ואותו גוף, לטקסט.
 *
 * ⚠️ בבקשת בעל המוצר 26/10: "לאפשר ייבוא אירועים מכל תמונה או טקסט".
 * ⚠️⚠️ ואותה הנחיה בדיוק, ואותה סכימה. המקור משתנה, ומה שצריך לחזור ממנו לא.
 * DOCS/PLANING/39
 *
 * ⚠️ והחתימה של `requestBodyFor` לא נגעה, כי בדיקה נועלת אותה.
 */
export function requestBodyForText(text) {
  return {
    contents: [
      {
        parts: [{ text: promptFor() }, { text: `המקור:\n${text}` }],
      },
    ],
    generationConfig: GENERATION_CONFIG,
  };
}

/** ⚠️ מגבלת הטקסט. אותו סדר גודל כמו תמונה, ומפני קלט מופרך. */
export const MAX_TEXT_CHARS = 20000;
