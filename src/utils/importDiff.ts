// src/utils/importDiff.ts
//
// ⚠️⚠️ מה הייבוא עומד לשנות ביום קיים, ומה ממנו ייעלם.
//
// נכתב בגלל באג שנמדד: ייבוא שני לאותו חודש מחק את ההערה שהמנהלת כתבה, הסיר
// אירוע שהיא הוסיפה, והחזיר יום שהיא סגרה למצב פתוח לכולם. רשומה
// DOCS/PLANING/25-the-second-import-erases-the-manager-edit.md
//
// בלשון בעל המוצר: "הוא לא יכול להשמיד נתונים ללא אישור, ובברירת מחדל הוא
// אמור להראות היכן ההתנגשויות ולתת לאשר ידנית."
//
// ⚠️ ולכן שתי תשובות ולא אחת:
//   1. `changes` הוא מה שיוצג למנהלת, כל שינוי בשורה משלו.
//   2. `fields` הוא מה שייכתב, **ורק מה שהמודל קרא.** שדה ששתק אינו נשלח,
//      ולכן `merge` של Firestore משאיר את הערך שלה במקומו.
//
// ⚠️ וזו פונקציה טהורה, ונקראת מתוך `useMemo` ברכיב. CLAUDE.md, זרימת נתונים.
//
// ⚠️⚠️ ומ-26/10/2026 הייבוא כן כותב `closesAt`, וזה היפוך של מה שכתוב כאן קודם.
//
// בקשת בעל המוצר: "להוסיף חצי שעה לפני כל אירוע מייובא (ולציין זאת)". השעה
// נגזרת מהאירוע המוקדם ביותר ביום פחות 30 דקות, והיא נכתבת למסד כדי שתעבור גם
// לפיד ליומן. DOCS/PLANING/38
//
// ⚠️ ומה שהייבוא עוד אינו מוחק: שעת סגירה שהמנהלת כתבה ביד. יום שסומן `app`
// אינו מוחלף בשקט, והוא מוצג כהתנגשות שהיא מאשרת. DOCS/PLANING/25

import type {
  ActivityDay,
  ActivityEvent,
  MemberAccess,
  OpeningHours,
  PublicAccess,
} from '../types';
import type { ImportedDay } from '../services/importService';
import { closingCauseOf, closingFor } from './closing.ts';

/** מה הייבוא עושה ליום הזה. */
export type DayVerdict =
  /** אין רשומה ליום הזה. אין מה לאבד. */
  | 'new'
  /** יש רשומה, ומה שנקרא זהה לה. */
  | 'same'
  /** יש רשומה, והייבוא רק מוסיף עליה. */
  | 'adds'
  /** ⚠️ יש רשומה, ומשהו שכתוב בה ייעלם. */
  | 'conflict';

export interface DayChange {
  /** ⚠️ `erase` הוא מה שמצדיק אישור ידני. השאר מוצג ואינו מסוכן. */
  kind: 'add' | 'erase' | 'keep';
  text: string;
}

/**
 * המצב שיום בלי רשומה נושא ממילא.
 *
 * ⚠️ והוא נכנס כפרמטר ואינו נקרא כאן. הכלל של שישי ושבת יושב ב-`dayAccessOf`,
 * והוא המקור היחיד שלו. פונקציה שמחשבת הפרש אינה המקום שבו הוא נכתב שוב.
 */
export interface FallbackAccess {
  publicAccess: PublicAccess;
  memberAccess: MemberAccess;
}

export interface DayPlan {
  verdict: DayVerdict;
  changes: DayChange[];
  /** מה שייכתב למסד, ורק הוא. */
  fields: Partial<Omit<ActivityDay, 'id' | 'branchId'>> & { date: string };
}

const ACCESS_WORD: Record<string, string> = {
  'open|open': 'פתוח לכולם',
  'closed|open': 'פתוח לחברי אופן ספייס בלבד',
  'closed|closed': 'סגור',
  'closesEarly|open': 'נסגר מוקדם',
  'closesEarly|closed': 'נסגר מוקדם, וסגור לחברים',
};

function accessWord(publicAccess: PublicAccess, memberAccess: MemberAccess): string {
  return ACCESS_WORD[`${publicAccess}|${memberAccess}`] ?? 'מצב אחר';
}

/** ⚠️ שם ושעות, ולא השם לבד. "פילוסופיה 19:00" ו"פילוסופיה 20:30" אינם אותו אירוע. */
function eventKey(event: ActivityEvent): string {
  // ⚠️ והחלל חלק מהמפתח: אירוע שהמנהלת שייכה לחלל בשלב הייבוא הוא שינוי,
  // ובלי זה היום היה נחשב "ללא שינוי" והשיוך לא היה נשמר. DOCS/PLANING/26
  //
  // ⚠️ ומאותה סיבה גם "ממשיך למחרת": הוא נסמן ביד בשלב הייבוא, ובלעדיו מהמפתח
  // הסימון לא היה נשמר. DOCS/PLANING/42
  return [
    event.title.trim(),
    event.startTime ?? '',
    event.endTime ?? '',
    event.spaceId ?? '',
    event.endsNextDay ? 'next' : '',
  ].join('|');
}

function eventLabel(event: ActivityEvent): string {
  return event.startTime ? `${event.title} ${event.startTime}` : event.title;
}

/**
 * שעת הסגירה, ⚠️ ולידה שם האירוע שגרם לה.
 *
 * בלשון בעל המוצר, 26/10, "ולציין זאת": המנהלת צריכה לדעת למה היום נסגר
 * מוקדם, ולא רק באיזו שעה. DOCS/PLANING/38
 */
function closingLabel(closesAt: string, events: ActivityEvent[]): string {
  const cause = closingCauseOf(events, closesAt);
  return cause ? `שעת סגירה ${closesAt}, לקראת ${cause}` : `שעת סגירה ${closesAt}`;
}

/**
 * מה הייבוא עומד לעשות ליום אחד.
 *
 * ⚠️ `stored` הוא `undefined` כשאין רשומה. זה לא אותו דבר כמו רשומה ריקה:
 * יום בלי רשומה נגזר מהכלל של שישי ושבת, ולכן הייבוא כן כותב לו מצב.
 */
export function planFor(
  imported: ImportedDay,
  stored: ActivityDay | undefined,
  fallback: FallbackAccess,
  hours?: OpeningHours | null,
): DayPlan {
  const note = imported.note.trim();
  const events = imported.events;

  if (!stored) {
    /*
      ⚠️ מצב שהמודל לא קרא נגזר מהכלל ואינו נכתב כ"פתוח לכולם". `fallback` הוא
      מה שהיום נושא ממילא, וזה מה שהמוצר אומר בלי הייבוא.
    */
    const next = imported.access === 'unknown' ? fallback : toFields(imported.access);
    const { memberAccess } = next;

    /*
      ⚠️⚠️ וחצי השעה לפני האירוע, בבקשת בעל המוצר 26/10. DOCS/PLANING/38
      היא נגזרת כאן ונכתבת למסד, ואינה מחושבת בתצוגה.
    */
    const closing = closingFor(events, next.publicAccess, hours);
    const publicAccess = closing?.publicAccess ?? next.publicAccess;
    const closesAt = closing?.closesAt;

    const changes: DayChange[] = [
      { kind: 'add', text: accessWord(publicAccess, memberAccess) },
    ];
    if (closesAt) changes.push({ kind: 'add', text: closingLabel(closesAt, events) });
    if (note) changes.push({ kind: 'add', text: `הערה: ${note}` });
    for (const event of events) changes.push({ kind: 'add', text: eventLabel(event) });

    return {
      verdict: 'new',
      changes,
      // ⚠️ `source` נכתב ליום חדש בלבד. ביום קיים הוא עדות שאדם נגע בו.
      fields: {
        date: imported.date,
        events,
        publicAccess,
        memberAccess,
        ...(closesAt ? { closesAt } : {}),
        ...(note ? { note } : {}),
        source: 'import2026' as const,
      },
    };
  }

  const changes: DayChange[] = [];
  const fields: DayPlan['fields'] = { date: imported.date };

  // ---------- מצב היום ----------
  /*
    ⚠️ המודל ששתק אינו משנה מצב. זה הדבר שהחזיר יום סגור למצב פתוח.
    ⚠️ ולכן נקודת הפתיחה היא מה שהמודל קרא, ובשתיקתו מה שכבר כתוב ביום.
  */
  const read = imported.access !== 'unknown'
    ? toFields(imported.access)
    : { publicAccess: stored.publicAccess, memberAccess: stored.memberAccess };

  /*
    ⚠️⚠️ וחצי השעה לפני האירוע נגזרת גם ביום קיים. DOCS/PLANING/38
    היא נכתבת על מה שהמודל קרא, ולכן יום שסגור לציבור אינו "נסגר מוקדם".
  */
  const closing = closingFor(events, read.publicAccess, hours);
  const next = {
    publicAccess: closing?.publicAccess ?? read.publicAccess,
    memberAccess: read.memberAccess,
  };
  /* ⚠️ שעה נגזרת בלבד. בלי גזירה הייבוא אינו נוגע בשעה שכבר יושבת ביום. */
  const nextClosesAt = closing ? closing.closesAt : stored.closesAt;

  const accessChanged =
    next.publicAccess !== stored.publicAccess || next.memberAccess !== stored.memberAccess;
  const closesChanged = nextClosesAt !== stored.closesAt;

  if (accessChanged || closesChanged) {
    /*
      ⚠️⚠️ הסימון שאומר מי נגע ביום, בהכרעת בעל המוצר 26/10 ("1- א").

      `source` הוא `app` רק כשאדם שמר את היום בעורך היום, נמדד ב-
      `saveActivityDay`. ⚠️ **ויום כזה אינו מוחלף בשקט:** גם תוספת של שעת
      סגירה היא שינוי של מה שהמנהלת קבעה, ולכן היא מוצגת כהתנגשות ומחכה
      לאישור שלה. DOCS/PLANING/25
    */
    const byManager = stored.source === 'app';

    /*
      ⚠️⚠️ ושני מקורות לשינוי מצב, והם אינם שווים.

      מה שהמודל קרא בתמונה מחליף את מה שכתוב ביום, וזה מה שהחזיר יום סגור
      למצב פתוח, ולכן הוא התנגשות. DOCS/PLANING/25

      ⚠️ **והסגירה שנגזרה מהאירוע אינה מוחקת כלום:** יום פתוח שיש בו אירוע
      ב-19:00 נסגר ב-18:30, וזה בדיוק מה שבעל המוצר ביקש. **לסמן אותו
      כהתנגשות היה אומר שכל יום בייבוא דורש אישור ביד**, וזה מרוקן את הייבוא
      מתוכן. DOCS/PLANING/38
    */
    const readChanged =
      imported.access !== 'unknown' &&
      (read.publicAccess !== stored.publicAccess || read.memberAccess !== stored.memberAccess);

    if (accessChanged) {
      changes.push({
        kind: readChanged || byManager ? 'erase' : 'add',
        text: `מצב היום: ${accessWord(stored.publicAccess, stored.memberAccess)} ⟵ ${accessWord(next.publicAccess, next.memberAccess)}`,
      });
      fields.publicAccess = next.publicAccess;
      fields.memberAccess = next.memberAccess;
    }

    if (closesChanged) {
      changes.push(
        stored.closesAt
          ? {
              kind: 'erase',
              text: `שעת סגירה: ${stored.closesAt} ⟵ ${nextClosesAt ?? 'בלי שעת סגירה'}`,
            }
          : {
              kind: byManager ? 'erase' : 'add',
              text: closingLabel(nextClosesAt ?? '', events),
            },
      );
      if (nextClosesAt) fields.closesAt = nextClosesAt;
    }

    /*
      ⚠️⚠️ ושעת סגירה שנשארת היא מצב שאינו עקבי, ולכן נאמרת.
      ⚠️ `mergeActivityDay` משמיט שדה שאינו נשלח ואינו מוחק אותו, נמדד, ולכן
      יום שעובר ל"סגור לציבור" יכול להישאר עם סגירה ב-16:00 שאיש לא ביקש.
    */
    if (stored.closesAt && !closesChanged && next.publicAccess !== 'closesEarly') {
      changes.push({ kind: 'keep', text: `שעת סגירה ${stored.closesAt} נשארת` });
    }
  }

  // ---------- הערה ----------
  // ⚠️ הערה ריקה אינה נשלחת בכלל. זה מה שמחק את "אירוע פרטי, הסלון סגור".
  const storedNote = (stored.note ?? '').trim();
  if (note && note !== storedNote) {
    changes.push(
      storedNote
        ? { kind: 'erase', text: `הערה: ${storedNote} ⟵ ${note}` }
        : { kind: 'add', text: `הערה: ${note}` },
    );
    fields.note = note;
  }

  // ---------- אירועים ----------
  /*
    ⚠️ מערך אינו ממוזג ב-Firestore אלא מוחלף, ולכן אירוע שאינו בתמונה נעלם.
    ואין כאן מיזוג אוטומטי: מה שנעלם מוצג, והמנהלת מאשרת.
  */
  const storedKeys = new Set(stored.events.map(eventKey));
  const importedKeys = new Set(events.map(eventKey));
  const removed = stored.events.filter((event) => !importedKeys.has(eventKey(event)));
  const added = events.filter((event) => !storedKeys.has(eventKey(event)));

  if (removed.length > 0 || added.length > 0) {
    for (const event of removed) changes.push({ kind: 'erase', text: `יוסר: ${eventLabel(event)}` });
    for (const event of added) changes.push({ kind: 'add', text: `יתווסף: ${eventLabel(event)}` });
    fields.events = events;
  }

  const verdict: DayVerdict = changes.some((change) => change.kind === 'erase')
    ? 'conflict'
    : changes.length === 0
      ? 'same'
      : 'adds';

  return { verdict, changes, fields };
}

const TO_FIELDS = {
  open: { publicAccess: 'open', memberAccess: 'open' },
  membersOnly: { publicAccess: 'closed', memberAccess: 'open' },
  closed: { publicAccess: 'closed', memberAccess: 'closed' },
} as const;

function toFields(access: Exclude<ImportedDay['access'], 'unknown'>) {
  return TO_FIELDS[access];
}
