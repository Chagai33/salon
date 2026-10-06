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
 * היא נכתבה מתוך לוח אוקטובר אמיתי שבעל המוצר שלח, ולא מתוך הדמיון:
 * ליום אחד יכולים להיות שני אירועים, כותרת יכולה להחזיק מרכאות, ויום יכול
 * לשאת שם חג בלי אריח.
 */
export function promptFor(monthKey) {
  return [
    `התמונה היא לוח אירועים חודשי של מרחב עבודה משותף, לחודש ${monthKey}.`,
    'החזר את האירועים שמופיעים בתאי הלוח.',
    '',
    'מה שיש בתמונה, לפי לוח אמיתי שנמדד:',
    '- העמודות הן ימי השבוע, מימין לשמאל: ראשון, שני, שלישי, רביעי, חמישי, שישי, שבת.',
    '- בכל תא מספר היום, ולפעמים אריח עם כותרת ושעה.',
    '- ⚠️ ליום אחד יכולים להיות שני אירועים ויותר. החזר את כולם.',
    '- כותרת יכולה להכיל מרכאות, למשל: השקת ספר "איך היא אוחזת".',
    '- יום יכול לשאת שם חג בלי אריח, למשל שמחת תורה. החזר אותו ב-note.',
    '',
    'כללים:',
    `1. כל תאריך בפורמט YYYY-MM-DD, ובחודש ${monthKey} בלבד.`,
    '2. אם תאריך או כותרת אינם קריאים, אל תחזיר אותם. אל תשלים ואל תנחש.',
    '3. שעות בפורמט HH:MM בלבד, ורק אם הן כתובות באריח.',
    '4. ⚠️ אל תחזיר שמות של אנשים, גם אם הם מופיעים בתמונה.',
    '5. ⚠️⚠️ `access` הוא "unknown" כברירת מחדל, וזו התשובה הנכונה כמעט תמיד.',
    '   החזר open, membersOnly או closed רק אם כתוב על אותו יום במפורש שהמרחב',
    '   פתוח, פתוח לחברים בלבד, או סגור. שעות פתיחה כלליות בתחתית הלוח אינן',
    '   מידע על יום מסוים, ואינן סיבה להחזיר open.',
    '6. ⚠️ התעלם מהכותרת שבראש התמונה, מהלוגו, ומהטקסט שבתחתיתה. קרא רק',
    '   את תאי הלוח.',
    '7. `confidence` הוא 0 עד 1, ומבטא כמה הקריאה של אותו יום ברורה.',
    '8. `note` הוא מה שכתוב על היום ואינו אירוע, למשל שם חג. עד 100 תווים.',
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
export function sanitiseDays(parsed, monthKey) {
  const days = Array.isArray(parsed?.days) ? parsed.days : [];

  return days
    .filter((day) => typeof day?.date === 'string' && day.date.startsWith(`${monthKey}-`))
    .slice(0, 31)
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
            }))
        : [],
      confidence: typeof day.confidence === 'number' ? day.confidence : 0,
    }))
    // ⚠️ יום בלי אירוע, בלי הערה ובלי מצב גישה אינו מידע. הוא רק מספר בלוח.
    .filter((day) => day.events.length > 0 || day.note || day.access !== 'unknown');
}

/** בונה את גוף הבקשה ל-Gemini. מופרד כדי שאפשר יהיה לבדוק אותו. */
export function requestBodyFor(monthKey, mimeType, imageBase64) {
  return {
    contents: [
      {
        parts: [
          { text: promptFor(monthKey) },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: SCHEMA,
      // ⚠️ אפס. קריאת לוח אינה יצירתיות, ואותה תמונה צריכה לתת אותה תשובה.
      temperature: 0,
    },
  };
}
