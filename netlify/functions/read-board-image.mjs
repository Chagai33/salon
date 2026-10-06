// netlify/functions/read-board-image.mjs
//
// קוראת תמונה של לוח חודשי, ומחזירה את מה שהמודל הבין כ-JSON.
//
// ⚠️⚠️ והפונקציה הזו קיימת כדי שהמפתח לא ייגע בדפדפן. מפתח Gemini שמוטמע
// באפליקציה נדחף לחבילה שהדפדפן מוריד, והמאגר הזה ציבורי. כאן הוא נקרא
// מ-`process.env` ואינו יוצא מהשרת.
//
// ⚠️ והיא אינה כותבת למסד. היא מחזירה הצעה, המנהלת רואה אותה על המסך, והכתיבה
// נעשית מהאפליקציה אחרי אישור. CLAUDE.md, אזור ליבה 4: הייבוא כותב מידע על
// ימים אמיתיים.

import { createVerify, X509Certificate } from 'node:crypto';

/**
 * ⚠️ המודל. `gemini-2.5` נסגר ב-16/10/2026, ולכן הוא אינו כאן.
 * `gemini-3.8-flash` הוא מה שגוגל ממליצה לפרויקט חדש, והוא מקבל תמונה.
 */
const MODEL = 'gemini-3.8-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** ⚠️ תמונה גדולה היא גם עלות וגם זמן. שני מגה הם צילום מסך של לוח. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/**
 * מאמתת אסימון זהות של Firebase.
 *
 * ⚠️ בלי זה הכתובת הזו פתוחה לכל העולם, וכל מי שימצא אותה שורף את המכסה
 * החינמית. זו אינה הגנה תיאורטית.
 *
 * ⚠️ ומה שהיא **אינה** בודקת: שהקורא הוא מנהלת. לשם כך היא הייתה צריכה לקרוא
 * את Firestore, וזה דורש חשבון שירות, כלומר סוד נוסף. מה שהיא כן מבטיחה הוא
 * שהקורא מחובר לפרויקט הזה, וזה מצמצם את החשיפה לחברי הקהילה.
 */
async function uidFromIdToken(token, projectId) {
  const [rawHeader, rawPayload, rawSignature] = String(token).split('.');
  if (!rawHeader || !rawPayload || !rawSignature) throw new Error('אסימון פגום');

  const header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8'));

  if (header.alg !== 'RS256') throw new Error('אלגוריתם לא נתמך');
  if (payload.aud !== projectId) throw new Error('אסימון של פרויקט אחר');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error('מנפיק לא צפוי');
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('אסימון פג');
  if (!payload.sub) throw new Error('אסימון בלי מזהה');

  const certs = await fetch(CERTS_URL).then((r) => r.json());
  const pem = certs[header.kid];
  if (!pem) throw new Error('מפתח חתימה לא נמצא');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${rawHeader}.${rawPayload}`);
  // ⚠️ `X509Certificate.publicKey` הוא כבר KeyObject. לעטוף אותו ב-
  //    `createPublicKey` זורק, וכל אסימון תקין נדחה. הבדיקה תפסה את זה.
  if (!verifier.verify(new X509Certificate(pem).publicKey, Buffer.from(rawSignature, 'base64url'))) {
    throw new Error('חתימה לא תקפה');
  }

  return payload.sub;
}

/**
 * ⚠️ ההנחיה למודל, והיא עיקר הדיוק כאן.
 *
 * היא אומרת במפורש מה **לא** לעשות: לא להמציא תאריך שאינו בתמונה, לא לנחש
 * שעות, ולא להחזיר שמות של אנשים. שמות אינם נדרשים לייבוא ימי פעילות,
 * והוצאתם מהתשובה היא צמצום של מה שעובר דרך מודל חיצוני.
 */
function promptFor(monthKey) {
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

const SCHEMA = {
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

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') return json(405, { error: 'method' });

  const apiKey = process.env.GEMINI_API_KEY;
  /*
    ⚠️ ששת ה-`VITE_FIREBASE_*` מוגדרים ב-Netlify ב-All scopes, ולכן הם זמינים
    גם לפונקציה. מזהה הפרויקט אינו סוד, הוא יושב בחבילה שהדפדפן מוריד ממילא,
    ולכן אין טעם לדרוש משתנה נוסף בשבילו.
  */
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;

  // ⚠️ הודעה שאומרת מה חסר, ולא "אירעה שגיאה".
  if (!apiKey) return json(500, { error: 'missingKey' });
  if (!projectId) return json(500, { error: 'missingProject' });

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return json(401, { error: 'noToken' });

  try {
    await uidFromIdToken(token, projectId);
  } catch {
    return json(401, { error: 'badToken' });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'badBody' });
  }

  const { imageBase64, mimeType, monthKey } = payload ?? {};
  if (!imageBase64 || !ALLOWED_TYPES.has(mimeType)) return json(400, { error: 'badImage' });
  if (!/^\d{4}-\d{2}$/.test(String(monthKey ?? ''))) return json(400, { error: 'badMonth' });

  // ⚠️ אורך base64 הוא בקירוב שליש יותר מהבתים, ולכן החישוב ולא האורך.
  const bytes = Math.floor((imageBase64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) return json(413, { error: 'tooLarge' });

  const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
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
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    // ⚠️ גוף התשובה של גוגל אינו מוחזר ללקוח. הוא יכול להכיל את המפתח בהד.
    console.error('[read-board-image] gemini', response.status);
    return json(502, { error: 'modelFailed', status: response.status });
  }

  const body = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return json(502, { error: 'emptyAnswer' });

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json(502, { error: 'notJson' });
  }

  // ⚠️ סינון בצד השרת גם כן. סכימה אינה הבטחה, והמודל יכול להחזיר תאריך
  //    מחודש אחר למרות ההנחיה.
  const days = Array.isArray(parsed?.days) ? parsed.days : [];
  const clean = days
    .filter((day) => typeof day?.date === 'string' && day.date.startsWith(`${monthKey}-`))
    .slice(0, 31)
    .map((day) => ({
      date: day.date,
      note: typeof day.note === 'string' ? day.note.slice(0, 100) : '',
      /*
        ⚠️⚠️ `unknown` ולא `open`.
        בתמונת לוח אמיתית אין שום מידע על מי סגור למי, ולכן ברירת מחדל `open`
        הייתה חותמת "פתוח לכולם" על כל יום שנקרא, כולל שישי ושבת, ומוחקת
        בשקט את כלל סוף השבוע ואת מה שהמנהלת הגדירה.
      */
      access: ['open', 'membersOnly', 'closed'].includes(day.access) ? day.access : 'unknown',
      events: Array.isArray(day.events)
        ? day.events
            .filter((event) => typeof event?.title === 'string' && event.title.trim())
            .slice(0, 6)
            .map((event) => ({
              title: String(event.title).slice(0, 80),
              startTime: /^\d{2}:\d{2}$/.test(event.startTime ?? '') ? event.startTime : undefined,
              endTime: /^\d{2}:\d{2}$/.test(event.endTime ?? '') ? event.endTime : undefined,
            }))
        : [],
      confidence: typeof day.confidence === 'number' ? day.confidence : 0,
    }))
    // ⚠️ יום בלי אירוע, בלי הערה ובלי מצב גישה אינו מידע. הוא רק מספר בלוח.
    .filter((day) => day.events.length > 0 || day.note || day.access !== 'unknown');

  return json(200, { model: MODEL, days: clean });
}
