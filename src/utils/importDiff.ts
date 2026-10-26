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
//
// ⚠️⚠️ ומ-26/10/2026 הייבוא אינו מוחק אירועים בכלל, בהכרעת בעל המוצר ("1א").
// הוא מוסיף את מה שנקרא ואינו בלוח, וממלא שדות באירוע שכבר קיים. DOCS/PLANING/56

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

/**
 * ⚠️⚠️ איזה מישור של היום השורה מדברת עליו.
 *
 * **נכתב בגלל סתירה שנראתה על המסך:** התגית אמרה "מצב היום לא משתנה",
 * ומתחתיה כתוב ששני אירועים יוסרו. ⚠️ **שניהם היו נכונים**, כי מצב הגישה של
 * היום באמת לא השתנה ורשימת האירועים שלו כן, **והמסך לא אמר שאלה שני
 * דברים.** DOCS/PLANING/56
 *
 * ⚠️ וההבחנה קיימת במודל הנתונים מההתחלה: `publicAccess`, `memberAccess`
 * ו-`closesAt` מול `events`, שדות נפרדים ב-`ActivityDay`. **היא נעלמה כאן,
 * ברשימה שטוחה אחת.**
 */
export type DayPlane =
  /** מצב הגישה של היום, ושעת הסגירה. */
  | 'access'
  /** ההערה שנכתבת ליום. */
  | 'note'
  /** רשימת האירועים. */
  | 'events';

export interface DayChange {
  /** ⚠️ `erase` הוא מה שמצדיק אישור ידני. השאר מוצג ואינו מסוכן. */
  kind: 'add' | 'erase' | 'keep';
  plane: DayPlane;
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
function eventIdentity(event: ActivityEvent): string {
  return [event.title.trim(), event.startTime ?? '', event.endTime ?? ''].join('|');
}

/**
 * ⚠️⚠️ מה הייבוא ממלא באירוע שכבר קיים בלוח.
 *
 * **שדה שהוא קרא נכנס, ושדה ששתק בו אינו מוחק.** זה אותו כלל בדיוק שעושה את
 * המיזוג אמיתי ברמת היום, `mergeActivityDay`, וכאן הוא ברמת האירוע.
 *
 * ⚠️ והחלל וה"ממשיך למחרת" הם השדות שנמלאים, כי שם והשעות הם הזהות של האירוע.
 *
 * ⚠️⚠️ ובלי זה היו נשברים שני דברים שנבנו קודם: המנהלת משייכת חלל בחלון
 * הייבוא, DOCS/PLANING/26, ומסמנת "ממשיך למחרת", DOCS/PLANING/42, **ושניהם
 * היו נבלעים** כי שם האירוע והשעה לא השתנו.
 *
 * ⚠️ ו-`overwrites` אומר שהשדה לא היה ריק. **אז זו דריסה של מה שהמנהלת
 * קבעה, והיא מחכה לאישור שלה**, DOCS/PLANING/25. **ושדה שהיה ריק הוא תוספת.**
 */
function fillEvent(
  stored: ActivityEvent,
  read: ActivityEvent,
): { event: ActivityEvent; changed: boolean; overwrites: boolean } {
  const event = { ...stored };
  let overwrites = false;

  if (read.spaceId !== undefined && read.spaceId !== stored.spaceId) {
    if (stored.spaceId !== undefined) overwrites = true;
    event.spaceId = read.spaceId;
  }
  if (read.endsNextDay !== undefined && read.endsNextDay !== stored.endsNextDay) {
    if (stored.endsNextDay !== undefined) overwrites = true;
    event.endsNextDay = read.endsNextDay;
  }

  const changed =
    event.spaceId !== stored.spaceId || event.endsNextDay !== stored.endsNextDay;
  return { event, changed, overwrites };
}

/**
 * ⚠️⚠️ רשימת האירועים שתישמר: הקיימים, ואחריהם מה שנקרא ואינו בהם.
 *
 * **הייבוא מוסיף ואינו מוחק**, בהכרעת בעל המוצר 26/10/2026 ("1א").
 * DOCS/PLANING/56
 *
 * ⚠️ והקיימים נשארים בסדרם, כדי שהדבקה אחת לא תסדר מחדש יום שלם.
 */
function mergeEvents(
  stored: ActivityEvent[],
  read: ActivityEvent[],
): { events: ActivityEvent[]; changes: DayChange[]; changed: boolean } {
  const changes: DayChange[] = [];
  const kept: ActivityEvent[] = [];
  let filled = false;

  for (const event of stored) {
    const match = read.find((item) => eventIdentity(item) === eventIdentity(event));
    if (!match) {
      kept.push(event);
      continue;
    }
    const merged = fillEvent(event, match);
    kept.push(merged.event);
    if (merged.changed) {
      filled = true;
      changes.push({
        kind: merged.overwrites ? 'erase' : 'add',
        plane: 'events',
        text: `ישתנה: ${eventLabel(merged.event)}`,
      });
    }
  }

  const storedIdentities = new Set(stored.map(eventIdentity));
  const added = read.filter((event) => !storedIdentities.has(eventIdentity(event)));
  for (const event of added) {
    changes.push({ kind: 'add', plane: 'events', text: `יתווסף: ${eventLabel(event)}` });
  }

  return { events: [...kept, ...added], changes, changed: filled || added.length > 0 };
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
      { kind: 'add', plane: 'access', text: accessWord(publicAccess, memberAccess) },
    ];
    if (closesAt) changes.push({ kind: 'add', plane: 'access', text: closingLabel(closesAt, events) });
    if (note) changes.push({ kind: 'add', plane: 'note', text: `הערה: ${note}` });
    for (const event of events) changes.push({ kind: 'add', plane: 'events', text: eventLabel(event) });

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

  /*
    ⚠️⚠️ רשימת האירועים נבנית ראשונה, והשורות שלה נכתבות בהמשך.

    ⚠️ **כי שעת הסגירה נגזרת מהרשימה שתישמר ולא ממה שנקרא.** יום שיש בו אירוע
    ב-10:00 בלוח, ושהודבקה לו שורה של אירוע ב-19:00, נסגר לפי 10:00 ולא לפי
    19:00. **בגרסה הראשונה הגזירה רצה על מה שנקרא בלבד, והיה יוצא 18:30 ליום
    שתפוס מהבוקר.** DOCS/PLANING/38, DOCS/PLANING/56
  */
  const merge = mergeEvents(stored.events, events);

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
  const closing = closingFor(merge.events, read.publicAccess, hours);
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

      מה שהמודל קרא בתמונה דורס את מה שכתוב ביום, וזה מה שהחזיר יום סגור
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
        plane: 'access',
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
              plane: 'access',
              text: `שעת סגירה: ${stored.closesAt} ⟵ ${nextClosesAt ?? 'בלי שעת סגירה'}`,
            }
          : {
              kind: byManager ? 'erase' : 'add',
              plane: 'access',
              text: closingLabel(nextClosesAt ?? '', merge.events),
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
      changes.push({ kind: 'keep', plane: 'access', text: `שעת סגירה ${stored.closesAt} נשארת` });
    }
  }

  // ---------- הערה ----------
  // ⚠️ הערה ריקה אינה נשלחת בכלל. זה מה שמחק את "אירוע פרטי, הסלון סגור".
  const storedNote = (stored.note ?? '').trim();
  if (note && note !== storedNote) {
    changes.push(
      storedNote
        ? { kind: 'erase', plane: 'note', text: `הערה: ${storedNote} ⟵ ${note}` }
        : { kind: 'add', plane: 'note', text: `הערה: ${note}` },
    );
    fields.note = note;
  }

  // ---------- אירועים ----------
  /*
    ⚠️⚠️ הייבוא מוסיף אירועים ואינו מוחק אותם, בהכרעת בעל המוצר 26/10 ("1א").

    **מה שהיה כאן קודם:** `fields.events = events`, כלומר מה שנקרא בלבד.
    ⚠️ **ומערך אינו ממוזג ב-Firestore אלא מוחלף**, ולכן אירוע שלא נקרא נעלם.
    ההערה הקודמת כאן קבעה "ואין כאן מיזוג אוטומטי: מה שנעלם מוצג, והמנהלת
    מאשרת", **וזו הייתה הכרעה כתובה ולא רק תוצאה של המבנה.**

    **ובפועל זה אמר:** בעל המוצר הדביק שורת טקסט אחת כדי להוסיף אירוע, **ושני
    אירועים קיימים סומנו להסרה.** בלשונו: "מה קורה פה? זה קצת מבלבל".

    ⚠️ **ומי שמדביק שורה מצפה להוסיף אותה.** מחיקה של אירועים שלא הזכיר היא
    הפתעה, **ומי שרוצה למחוק אירוע מוחק אותו ביד בעורך היום.**
    DOCS/PLANING/56

    ⚠️⚠️ **והכלל אחד לשני המסלולים, טקסט ותמונה**, בהכרעת בעל המוצר ("2א").
    נמדד שהם זהים לגמרי היום: `ImportedDay` אינו נושא שום סימן למקור. **וגם
    בצילום לוח שלם, "המודל לא קרא את האירוע" ו"האירוע בוטל" הם אותו דבר על
    המסך**, ונמדד שהמודל החזיר יום אחד מתוך 13 שורות, DOCS/PLANING/52.

    ⚠️ **ורשומה 25 אינה נפגעת אלא מתחזקת:** היא אסרה על מחיקה בשקט, **והמיזוג
    אינו מוחק כלל.**
  */
  for (const change of merge.changes) changes.push(change);
  if (merge.changed) fields.events = merge.events;

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
