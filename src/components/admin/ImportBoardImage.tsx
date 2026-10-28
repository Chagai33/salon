// src/components/admin/ImportBoardImage.tsx
//
// המנהלת מעלה צילום של הלוח, רואה מה נקרא, מסמנת מה נכון, ושומרת.
//
// ⚠️⚠️ ואין כאן "ייבוא". יש קריאה, אישור, ואז כתיבה.
// CLAUDE.md, אזור ליבה 4: הייבוא כותב מידע על ימים אמיתיים, ולכן מודל אינו
// כותב למסד. הוא מציע, והמנהלת מכריעה על כל יום בנפרד.
//
// ⚠️ ושורת "התמונה נשלחת לגוגל" אינה אופציונלית. זו הודעה בנקודת האיסוף.
//
// ⚠️⚠️ וכל יום מוצג מול מה שכבר כתוב בלוח, ולא לבד.
// ייבוא שני לאותו חודש מחק הערה שהמנהלת כתבה, הסיר אירוע שהיא הוסיפה, והחזיר
// יום שהיא סגרה למצב פתוח לכולם. נמדד מול האמולטור, רשומה
// DOCS/PLANING/25-the-second-import-erases-the-manager-edit.md
//
// בלשון בעל המוצר: "הוא לא יכול להשמיד נתונים ללא אישור, ובברירת מחדל הוא
// אמור להראות היכן ההתנגשויות ולתת לאשר ידנית."
//
// ⚠️ ולכן יום שדורס משהו קיים אינו מסומן מראש, בשום רמת ביטחון.

import { Button } from '../common/Button';
import { useMemo, useRef, useState } from 'react';
import { t } from '../../i18n/dictionary';
import { shortDateLabel } from '../../utils/dates';
import { monthNameOf, weekdayOf } from '../../utils/dates';
import { logEvent, mergeActivityDay } from '../../services/salonService';
import { MAX_TEXT_CHARS, readBoardImage, readBoardText } from '../../services/importService';
import type { ImportedDay, ImportedEvent, ImportStage } from '../../services/importService';
import { toReadableError } from '../../utils/errors';
import { StatusPill } from '../common/StatusPill';
import { Sheet } from '../common/Sheet';
import { dayAccessOf } from '../../utils/hebrew';
import { planFor } from '../../utils/importDiff';
import { splitByMonth } from '../../utils/importMonths';
import { useStore } from '../../store/useStore';
import { saveBranchSettings } from '../../services/salonService';
import { endsBeforeStart } from '../../utils/times';
import type { DayPlan, DayPlane, DayVerdict } from '../../utils/importDiff';
import type { ActivityDay } from '../../types';

/** ⚠️ קריאה מתחת לזה מסומנת למנהלת. 0.7 הוא שיקול ולא מדידה. */
const LOW_CONFIDENCE = 0.7;

/** ⚠️ הכלל של שישי ושבת יושב ב-`dayAccessOf`, והוא המקור היחיד שלו. */
function fallbackFor(dateKey: string) {
  const derived = dayAccessOf(dateKey, undefined, undefined);
  return { publicAccess: derived.publicAccess, memberAccess: derived.memberAccess };
}

const VERDICT_LABEL: Record<DayVerdict, string> = {
  new: t.importImage.verdictNew,
  adds: t.importImage.verdictAdds,
  same: t.importImage.verdictSame,
  conflict: t.importImage.verdictConflict,
};

/** ⚠️ והתנגשות אינה נושאת בצבע לבד. CLAUDE.md, עיצוב. */
const VERDICT_TONE: Record<DayVerdict, 'open' | 'taken' | 'membersOnly'> = {
  new: 'membersOnly',
  adds: 'membersOnly',
  same: 'taken',
  conflict: 'open',
};

/*
  ⚠️⚠️ שני מישורי היום, בסדר הזה: מה שנוגע לכל היום, ואז מה שבתוכו.
  DOCS/PLANING/56
*/
const PLANES: DayPlane[] = ['access', 'note', 'events'];

const PLANE_LABEL: Record<DayPlane, string> = {
  access: t.importImage.planeAccess,
  note: t.importImage.planeNote,
  events: t.importImage.planeEvents,
};

/** ⚠️ שלוש מדרגות, בסדר הזה, וזה גם הסדר של הפסים. */
const STAGES: ImportStage[] = ['preparing', 'sending', 'reading'];

const STAGE_LABEL: Record<ImportStage, string> = {
  preparing: t.importImage.stagePreparing,
  sending: t.importImage.stageSending,
  reading: t.importImage.stageReading,
};

/** ⚠️ מפתח ההשוואה של מאגר הדילוג. */
function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function messageFor(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  const known: Record<string, string> = {
    badType: t.importImage.badType,
    tooLarge: t.importImage.tooLarge,
    noToken: t.importImage.noToken,
    badToken: t.importImage.noToken,
    missingKey: t.importImage.missingKey,
    notManager: t.importImage.notManager,
    // ⚠️ שתי שגיאות של מסלול הטקסט, ושתיהן נזרקות בדפדפן. DOCS/PLANING/39
    emptyText: t.importImage.emptyText,
    tooLongText: t.importImage.tooLongText,
    noAuth: t.importImage.noToken,
    emptyAnswer: t.importImage.emptyAnswer,
    quotaExhausted: t.importImage.quotaExhausted,
    notJson: t.importImage.modelFailed,
    memberLookupFailed: t.importImage.memberLookupFailed,
    unexpected: t.importImage.unexpected,
  };
  return known[code] ?? t.importImage.modelFailed;
}

export function ImportBoardImage({
  branchId,
  monthKey,
  activityByDate,
  onOpenDay,
  onFinished,
  open,
  onOpenChange,
}: {
  branchId: string;
  monthKey: string;
  /** ⚠️ מה שכבר כתוב בלוח. בלעדיו אין דרך לדעת מה הייבוא דורס. */
  activityByDate: Map<string, ActivityDay>;
  /**
   * ⚠️ פתיחת היום לעריכה, בבקשת בעל המוצר 06/10: "לאפשר למנהלת לפתוח את
   * האירועים שהיא ייבאה מהתמונה בדיוק כמו שהיא עורכת שיבוצים וימים".
   * מודל שקורא תמונה טועה בכותרת ובשעה, והתיקון במרחק לחיצה מהשורה שבה
   * הטעות נראית. DOCS/PLANING/26
   */
  onOpenDay: (dateKey: string) => void;
  /**
   * ⚠️ נקראת אחרי שמירה שהצליחה.
   * בלשון בעל המוצר, 06/10: "בסיום הייבוא לסגור גם את החלון, כי הוא מוצג
   * אחרי שסיימתי ייבוא בהצלחה, אין לזה טעם". DOCS/PLANING/26
   */
  onFinished?: () => void;
  /**
   * ⚠️⚠️ הפתיחה נשלטת מבחוץ.
   * קודם הרכיב החזיק את המצב בעצמו, והוא ישב בתוך התפריט, ולכן החלון נפתח
   * מעל התפריט ושני הרקעים נראו יחד. בצילום הנייד של בעל המוצר, 06/10, זה
   * נראה כמו שני חלונות שנתקעו זה בזה. DOCS/PLANING/26
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reading, setReading] = useState(false);
  const [days, setDays] = useState<ImportedDay[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** כמה אירועים הושמטו לפי מאגר הדילוג של הסלון, לפני שהרשימה נבנתה. */
  const [skippedCount, setSkippedCount] = useState(0);
  /*
    ⚠️⚠️ מה שדולג בחלון הזה, והוא נשאר ברשימה.

    בלשון בעל המוצר, 26/10: "אם היא לחצה על לדלג לתמיד יהיה כפתור ביטול דילוג",
    **על אותו אירוע.** ⚠️ ולכן הלחיצה אינה מעלימה את השורה: היא מסמנת אותה,
    ובמקום הכפתור מופיע הביטול. DOCS/PLANING/41

    ⚠️ ואלה הכותרות המנורמלות, כמו במאגר הדילוג עצמו.
  */
  const [skippedNow, setSkippedNow] = useState<Set<string>>(new Set());
  /** ⚠️ null כשאין קריאה רצה. */
  const [stage, setStage] = useState<ImportStage | null>(null);
  /** הטקסט שהמנהלת הדביקה, כמקור חלופי לתמונה. DOCS/PLANING/39 */
  const [pasted, setPasted] = useState('');
  /*
    ⚠️⚠️ מזהה הקריאה שרצה, וביטול הוא העלאה שלו.

    בבקשת בעל המוצר, 28/10: "אני רוצה להוסיף כפתור שמבטל את העיבוד של
    התמונה". ⚠️ **ומזהה ולא דגל:** המנהלת יכולה לבטל ולהתחיל קריאה חדשה
    לפני שהראשונה חזרה, **ודגל היה גורם לתשובה של הראשונה להיזרק יחד עם
    השנייה.** DOCS/PLANING/58
  */
  /*
    ⚠️ ו-ref ולא מצב רכיב: `then` קורא אותו אחרי שש עשרה שניות, ומצב נקרא
    שם כפי שהיה ברגע הקריאה, כלומר לפני הביטול. ⚠️ ואין מי שמרנדר לפיו.
  */
  const runRef = useRef(0);

  function startRun() {
    runRef.current += 1;
    return runRef.current;
  }

  /*
    ⚠️⚠️ מה הביטול מבטל, ומה אינו יכול לבטל.

    ✅ **ההמתנה נעצרת**, והמסך חוזר למצב שלפני.
    ✅ **והתשובה שתגיע נזרקת**, ואינה מציגה רשימה אחרי שהמנהלת ביטלה.
    ⚠️⚠️ **והקריאה בצד השרת ממשיכה עד סופה, והמודל מחויב.**
    `httpsCallable` של Firebase אינו מקבל אות ביטול ואינו חושף דרך לנתק
    קריאה שרצה. **ולכן זה נאמר במילים במסך ואינו מוסתר.** DOCS/PLANING/58
  */
  function cancelRun() {
    runRef.current += 1;
    setReading(false);
    setStage(null);
  }

  const branch = useStore((state) => state.branch);
  /* ⚠️ מעבר חודש, בלי קריאה שנייה למודל. DOCS/PLANING/57 */
  const setMonthKey = useStore((state) => state.setMonthKey);
  const isMonthLoading = useStore((state) => state.isMonthLoading);
  /** ⚠️ מי מייבא. הייבוא כותב מידע על ימים אמיתיים, ולכן הוא נרשם.
   *  DOCS/PLANING/29 */
  const me = useStore((state) => state.member);
  const spaces = useMemo(
    () => (branch?.spaces ?? []).filter((space) => space.isActive),
    [branch?.spaces],
  );
  /*
    ⚠️ מאגר הדילוג, בבקשת בעל המוצר 06/10.
    ⚠️ וההשוואה היא על הטקסט אחרי `trim`, בלי רגישות לרישיות: "קבוצת ריצה"
    ו"קבוצת ריצה " הם אותו אירוע חוזר. DOCS/PLANING/26
  */
  const ignored = useMemo(
    () => new Set((branch?.importIgnore ?? []).map(normalizeTitle)),
    [branch?.importIgnore],
  );

  /*
    ⚠️ שעות הסלון, והן הגבול של שעת הסגירה הנגזרת.
    אירוע ב-10:00 בסלון שנפתח ב-10:00 גוזר 09:30, ⚠️ ואז היום סגור לציבור ואינו
    "נסגר מוקדם", בהכרעת בעל המוצר ("4א"). DOCS/PLANING/38
  */
  const openingHours = branch?.openingHours;

  const monthName = useMemo(() => monthNameOf(monthKey), [monthKey]);

  /*
    ⚠️ ב-useMemo ולא בבורר ולא בגוף הרכיב. `planFor` בונה אובייקט חדש בכל
    קריאה. CLAUDE.md, זרימת נתונים.
  */
  /*
    ⚠️⚠️ ההפרדה לפי חודש, וממנה נגזרים שלושת המצבים של המסך.
    ⚠️ וב-useMemo: הפונקציה בונה אובייקט חדש בכל קריאה. CLAUDE.md, זרימת נתונים.
    DOCS/PLANING/57
  */
  const split = useMemo(() => (days ? splitByMonth(days, monthKey) : null), [days, monthKey]);

  const plans = useMemo(() => {
    if (!split) return null;
    const byDate = new Map<string, DayPlan>();
    /*
      ⚠️⚠️ ורק הימים של החודש שנבחר. הייבוא אינו כותב לחודש אחר בשקט.
      נמדד ש-`planFor` משווה מול הלוח של החודש המוצג, ולכן יום של חודש אחר
      היה נכתב מול לוח שאינו שלו. DOCS/PLANING/57
    */
    for (const day of split.chosen) {
      /*
        ⚠️ אירוע בלי כותרת נזרק, כמו בעורך היום.
        שורה שהמנהלת רוקנה אינה אירוע, והיא גם לא תיכתב למסד.
      */
      const clean = {
        ...day,
        events: day.events
          .filter((event) => event.title.trim())
          /*
            ⚠️⚠️ ושם החלל שהמודל קרא אינו נכתב למסד.
            `ActivityEvent` נושא `spaceId` ולא שם, והשם הוא טקסט חופשי מהתמונה.
            ⚠️ והוא נשאר ב-`days` כדי שהמנהלת תראה מה נקרא. DOCS/PLANING/52
          */
          .map(({ space: _space, ...event }) => event)
          /*
            ⚠️⚠️ ואירוע שדולג בחלון הזה אינו נכתב, אף שהוא נראה ברשימה.
            הוא מסומן כמדולג, והתוכנית היא מה שייכתב למסד. DOCS/PLANING/41
          */
          .filter((event) => !skippedNow.has(normalizeTitle(event.title)))
          .map((event) => ({ ...event, title: event.title.trim() })),
      };
      byDate.set(
        day.date,
        planFor(
          clean,
          activityByDate.get(day.date),
          fallbackFor(day.date),
          openingHours?.[weekdayOf(day.date)] ?? null,
        ),
      );
    }
    return byDate;
  }, [split, activityByDate, skippedNow, openingHours]);

  const conflictCount = useMemo(
    () => (plans ? [...plans.values()].filter((plan) => plan.verdict === 'conflict').length : 0),
    [plans],
  );

  const chosenConflicts = useMemo(
    () =>
      plans
        ? [...chosen].filter((date) => plans.get(date)?.verdict === 'conflict').length
        : 0,
    [plans, chosen],
  );

  function reset() {
    setDays(null);
    setChosen(new Set());
    setProblem(null);
    /*
      ⚠️ וקריאה חדשה מתחילה בלי סימוני דילוג.
      הכותרות כבר במאגר הדילוג של הסלון, ולכן `onPick` מסנן אותן ממילא ומונה
      אותן. DOCS/PLANING/41
    */
    setSkippedNow(new Set());
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    reset();
    setReading(true);
    setStage('preparing');
    absorb(readBoardImage(file, branchId, monthKey, setStage), startRun());
  }

  /*
    ⚠️⚠️ קריאה מטקסט שהודבק, בבקשת בעל המוצר 26/10: "לאפשר ייבוא אירועים מכל
    תמונה או טקסט". DOCS/PLANING/39

    ⚠️ ואותה פונקציית ענן, אותה הנחיה, ואותה רשימה אחר כך.
  */
  function onReadText() {
    if (!pasted.trim()) return;
    reset();
    setReading(true);
    setStage('sending');
    absorb(readBoardText(pasted, branchId, monthKey, setStage), startRun());
  }

  /*
    ⚠️ מה שקורה לכל קריאה, בלי קשר למקור שלה.
    ⚠️⚠️ ובמקום אחד: שני מסלולים שבונים את הרשימה בנפרד הם שני מקומות שבהם
    הסימון מראש של רשומה 25 יכול להישבר.
  */
  function absorb(request: Promise<ImportedDay[]>, run: number) {
    void request
      .then((raw) => {
        /*
          ⚠️⚠️ ותשובה של קריאה שבוטלה נזרקת ואינה מציגה רשימה.
          **זה מה שהביטול באמת עושה בצד הלקוח**, והוא כל מה שהוא יכול
          לעשות: הקריאה עצמה ממשיכה בצד השרת. DOCS/PLANING/58
        */
        if (run !== runRef.current) return;
        /*
          ⚠️ מה שבמאגר הדילוג אינו נכנס לרשימה בכלל.
          הוא גם אינו נכתב למסד, ⚠️ והמנהלת רואה כמה הושמטו כדי שלא תחשוב
          שהמודל פספס אותם. DOCS/PLANING/26
        */
        let skipped = 0;
        const found = raw.map((day) => {
          const events = day.events
            .filter((event) => !ignored.has(normalizeTitle(event.title)))
            /*
              ⚠️⚠️ שם החלל שנקרא מותאם לרשימת החללים של הסלון.
              החלל במוצר הוא ישות עם מזהה, והמודל מחזיר טקסט. ⚠️ וההתאמה היא
              על השם אחרי `trim` ובלי רגישות לרישיות, כמו מאגר הדילוג.
              ⚠️ ובלי התאמה השדה נשאר "בלי חלל", והשם שנקרא מוצג למנהלת כדי
              שהיא תדע שהוא כן נקרא. DOCS/PLANING/52
            */
            .map((event) => {
              if (!event.space || event.spaceId) return event;
              const match = spaces.find(
                (space) => normalizeTitle(space.name) === normalizeTitle(event.space ?? ''),
              );
              return match ? { ...event, spaceId: match.id } : event;
            });
          skipped += day.events.length - events.length;
          return { ...day, events };
        });
        setSkippedCount(skipped);
        setDays(found);
        /*
          ⚠️⚠️ מסומן מראש רק מה שאינו מוחק כלום.

          שני תנאים, ושניהם נדרשים: קריאה ברורה, **ויום שאינו דורס מה שכבר
          כתוב בלוח.** יום כזה אינו מסומן בשום רמת ביטחון, גם 1.0, כי הסימון
          מראש הוא אישור שהמנהלת לא נתנה. רשומה 25.
        */
        setChosen(
          new Set(
            found
              .filter((day) => {
                if (day.confidence < LOW_CONFIDENCE) return false;
                const verdict = planFor(
                  day,
                  activityByDate.get(day.date),
                  fallbackFor(day.date),
                  openingHours?.[weekdayOf(day.date)] ?? null,
                ).verdict;
                return verdict === 'new' || verdict === 'adds';
              })
              .map((day) => day.date),
          ),
        );
      })
      .catch((error: unknown) => {
        if (run !== runRef.current) return;
        setProblem(messageFor(error));
      })
      .finally(() => {
        if (run !== runRef.current) return;
        setReading(false);
        setStage(null);
      });
  }

  function save() {
    if (!days || !plans) return;

    /*
      ⚠️⚠️ בדיקה בשמירה, ולא `min` בשדה בלבד.
      `min` ב-`type="time"` מצמצם את הבורר ואינו חוסם הקלדה, ⚠️ ובייבוא הוא
      גם אינו נוגע במה שהמודל החזיר. מה שבאמת עוצר יושב כאן.

      ⚠️ ונבדקים הימים המסומנים בלבד. יום שהמנהלת לא סימנה אינו נכתב, ואין
      סיבה שהוא יעצור את השמירה. DOCS/PLANING/42

      ⚠️⚠️ ואירוע מדולג אינו נבדק, מאותה סיבה בדיוק: הוא אינו נכתב.
      בלי התנאי הזה אירוע שהמנהלת דילגה עליו היה חוסם את השמירה, והיא הייתה
      צריכה לתקן שעה באירוע שהיא כבר הוציאה מהייבוא. DOCS/PLANING/41
    */
    const broken = days.find(
      (day) =>
        chosen.has(day.date) &&
        day.events.some(
          (event) =>
            !skippedNow.has(normalizeTitle(event.title)) &&
            endsBeforeStart(event.startTime, event.endTime, event.endsNextDay),
        ),
    );
    if (broken) {
      setProblem(t.importImage.badEndTime(shortDateLabel(broken.date)));
      return;
    }

    /*
      ⚠️⚠️ ונכתבים `plan.fields` ולא מה שהמודל החזיר.

      `fields` מחזיק את השדות שהמודל קרא בלבד. שדה ששתק אינו נשלח, ולכן
      `merge` של Firestore משאיר את הערך של המנהלת במקומו. רשומה 25.
    */
    const picked = days
      .filter((day) => chosen.has(day.date))
      .map((day) => plans.get(day.date))
      .filter((plan): plan is DayPlan => plan !== undefined && plan.verdict !== 'same');

    setSaving(true);
    setProblem(null);
    /*
      ⚠️ שורה אחת לייבוא, ולא שורה לכל יום. ייבוא הוא פעולה אחת של אדם אחד,
      ו-`count` אומר בכמה ימים היא נגעה. DOCS/PLANING/29

      ⚠️⚠️ ובתוך אותה רשימת כתיבות, ולא בשלב שאחריה.
      שלב נפרד היה אומר "לא נשמר, שום דבר לא אבד" על ייבוא שכן נכתב, כי
      הימים נכתבו קודם והשורה נפלה אחריהם.
    */
    void Promise.all([
      ...picked.map((plan) => mergeActivityDay(branchId, plan.fields)),
      logEvent(branchId, {
        actorMemberId: me?.id ?? '',
        action: 'importRan',
        count: picked.length,
      }),
    ])
      .then(() => {
        /*
          ⚠️ נסגר, ולא נשאר פתוח עם הודעת הצלחה.
          הלוח מאחוריו כבר מראה את מה שנכתב, וזו ההודעה האמיתית.
        */
        reset();
        onOpenChange(false);
        onFinished?.();
      })
      .catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)))
      .finally(() => setSaving(false));
  }


  /*
    ⚠️⚠️ מקובץ, ובסדר הזה: מה שדורס קודם.
    הרשימה הקודמת הייתה רצף של עשרים שורות בתוך עמוד שגם הוא נגלל, ומה שדורס
    התגלה בגלילה. DOCS/PLANING/26
  */
  const groups = useMemo(() => {
    if (!split || !plans) return null;
    const order: DayVerdict[] = ['conflict', 'new', 'adds', 'same'];
    return order.map((verdict) => ({
      verdict,
      days: split.chosen.filter((day) => plans.get(day.date)?.verdict === verdict),
    }));
  }, [split, plans]);

  /*
    ⚠️ מה שמסומן ושייך לחודש שמוצג עכשיו.
    אחרי מעבר חודש הסימונים של החודש הקודם נשארים ב-`chosen`, ⚠️ והם אינם
    נכתבים כי אין להם תוכנית. בלי המונה הזה הכפתור היה אומר מספר שאינו נשמר.
  */
  const chosenHere = useMemo(
    () => (plans ? [...chosen].filter((date) => plans.has(date)).length : 0),
    [plans, chosen],
  );

  if (!open) return null;

  function close() {
    reset();
    onOpenChange(false);
  }

  /*
    עריכת אירוע עוד לפני השמירה. ⚠️ משנה את מה שייכתב, ולא רק את התצוגה.

    ⚠️⚠️ והשם נערך כאן ולא רק אחרי השמירה.
    בעל המוצר שאל 06/10 "למה אני לא יכול לערוך את השם של האירוע שייבאתי":
    השם היה טקסט בלבד בחלון הייבוא, והיה ניתן לעריכה רק בעורך היום, אחרי
    שהוא כבר נכתב למסד. מודל שקורא תמונה טועה בכותרת, והתיקון צריך להיות
    לפני הכתיבה. DOCS/PLANING/26
  */
  function patchEvent(date: string, index: number, patch: Partial<ImportedEvent>) {
    setDays(
      (current) =>
        current?.map((day) =>
          day.date === date
            ? {
                ...day,
                events: day.events.map((event, i) =>
                  i === index ? { ...event, ...patch } : event,
                ),
              }
            : day,
        ) ?? null,
    );
  }

  /** ⚠️ שעה ריקה נשמרת כ-undefined ולא כמחרוזת ריקה. אחרת הלוח מציג `-`. */
  function timeOrNone(value: string): string | undefined {
    return /^\d{2}:\d{2}$/.test(value) ? value : undefined;
  }

  /*
    ⚠️ מוסיף למאגר הדילוג של הסלון.
    בלשון בעל המוצר, 06/10: "אירועים חוזרים שאינם מתקיימים בסלון או לא
    רלוונטיים אליו". חוזר פירושו שהוא יחזור גם בייבוא הבא. DOCS/PLANING/26

    ⚠️⚠️ ואינו מעלים את השורה, מ-26/10.
    קודם הוא הסיר את האירוע מכל הימים, ⚠️ ואז לא היה על מה ללחוץ כדי לבטל:
    לחיצה אחת בטעות מחקה אירוע חוזר מכל ייבוא עתידי, והדרך היחידה לחזור ממנה
    הייתה מסך ההגדרות, שאינו קיים.

    בלשון בעל המוצר, 26/10: "אם היא לחצה על לדלג לתמיד יהיה כפתור ביטול דילוג",
    **על אותו אירוע.** DOCS/PLANING/41
  */
  function skipAlways(title: string) {
    if (!branch) return;
    void saveBranchSettings(
      branchId,
      { importIgnore: [...(branch.importIgnore ?? []), title.trim()] },
      me?.id ?? '',
    ).catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)));

    setSkippedNow((current) => new Set(current).add(normalizeTitle(title)));
  }

  /*
    ⚠️⚠️ הביטול, ובאותו חלון.
    מסיר את הכותרת ממאגר הדילוג של הסלון ומחזיר את האירוע לרשימה.

    ⚠️ וההשוואה מנורמלת ולא על הטקסט כפי שנשמר: במאגר יושב מה שהמודל קרא אחרי
    `trim`, וכאן נמחק מה שתואם לו בלי רגישות לרישיות. DOCS/PLANING/41
  */
  function undoSkip(title: string) {
    if (!branch) return;
    const key = normalizeTitle(title);
    void saveBranchSettings(
      branchId,
      {
        importIgnore: (branch.importIgnore ?? []).filter(
          (stored) => normalizeTitle(stored) !== key,
        ),
      },
      me?.id ?? '',
    ).catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)));

    setSkippedNow((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function rowFor(date: string) {
    const plan = plans?.get(date);
    if (!plan) return null;
    const day = days?.find((item) => item.date === date);
    if (!day) return null;
    // ⚠️ יום שאין בו מה לשנות אינו ניתן לסימון. אין מה לאשר.
    const nothingToDo = plan.verdict === 'same';

    return (
      <li key={date} className="py-2">
        <label className={`flex items-start gap-3 ${nothingToDo ? '' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            disabled={nothingToDo}
            checked={chosen.has(date)}
            onChange={(event) => {
              const next = new Set(chosen);
              if (event.target.checked) next.add(date);
              else next.delete(date);
              setChosen(next);
            }}
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">{shortDateLabel(date)}</span>
              {/* ⚠️ אותו עורך שבו נערך כל יום אחר, ולא מסך נפרד לייבוא. */}
              <Button tone="quiet" size="xs" className="text-brand" onClick={() => onOpenDay(date)}>
                {t.importImage.openDay}
              </Button>
              {/* ⚠️ "מצב היום לא משתנה". מה שכן משתנה מפורט למטה. */}
              {day.access === 'unknown' && (
                <StatusPill tone="taken">{t.importImage.accessUnknown}</StatusPill>
              )}
              {day.confidence < LOW_CONFIDENCE && (
                <StatusPill tone="open">{t.importImage.lowConfidence}</StatusPill>
              )}
            </span>

            {/*
              ⚠️ האירועים עצמם, ולא רק סיכום של מה ישתנה.
              כאן המנהלת משייכת חלל, וכאן היא מוציאה אירוע חוזר מהייבוא.
              DOCS/PLANING/26
            */}
            {day.events.length > 0 && (
              <ul className="mt-1 flex flex-col gap-1">
                {day.events.map((event, index) => {
                  const skipped = skippedNow.has(normalizeTitle(event.title));

                  /*
                    ⚠️⚠️ אירוע שדולג נשאר ברשימה, מסומן, ועם ביטול.
                    בלשון בעל המוצר, 26/10: "אם היא לחצה על לדלג לתמיד יהיה
                    כפתור ביטול דילוג", על אותו אירוע. DOCS/PLANING/41

                    ⚠️ והשדות נסגרים, כי אירוע שאינו נכתב אין מה לערוך בו.
                    ⚠️ ומילה ולא צבע לבד. CLAUDE.md, עיצוב.
                  */
                  if (skipped) {
                    return (
                      <li key={index} className="flex flex-wrap items-center gap-2">
                        <span dir="auto" className="min-w-0 flex-1 text-sm text-ink-faint line-through">
                          {event.title}
                        </span>
                        <StatusPill tone="taken">{t.importImage.skippedMark}</StatusPill>
                        <Button tone="quiet" size="xs" className="text-brand" onClick={() => undoSkip(event.title)}>
                          {t.importImage.undoSkip}
                        </Button>
                      </li>
                    );
                  }

                  return (
                  /* ⚠️ בטלפון השם בשורה משלו והפקדים מתחתיו: חמישה פקדים
                     ברוחב 390 נדחסים לשורה שאי אפשר להקליד בה. */
                  <li key={index} className="flex flex-wrap items-center gap-2">
                    {/* ⚠️ שדות ולא טקסט: מה שהמודל קרא נערך לפני שהוא נכתב. */}
                    <input
                      type="time"
                      aria-label={t.day.eventFrom}
                      value={event.startTime ?? ''}
                      onChange={(e) => patchEvent(date, index, { startTime: timeOrNone(e.target.value) })}
                      className="num shrink-0 rounded-card border border-line px-1.5 py-1 text-xs text-ink"
                    />
                    {/* ⚠️ הגבול התחתון הוא שעת ההתחלה, ומשתחרר כשהאירוע
                        ממשיך למחרת. DOCS/PLANING/42 */}
                    <input
                      type="time"
                      aria-label={t.day.eventTo}
                      value={event.endTime ?? ''}
                      min={event.endsNextDay ? undefined : event.startTime}
                      onChange={(e) => patchEvent(date, index, { endTime: timeOrNone(e.target.value) })}
                      className="num shrink-0 rounded-card border border-line px-1.5 py-1 text-xs text-ink"
                    />

                    {/* ⚠️⚠️ סימון ולא הסקה. DOCS/PLANING/42 */}
                    <label className="flex shrink-0 items-center gap-1 text-xs text-ink-soft">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={event.endsNextDay ?? false}
                        onChange={(e) =>
                          patchEvent(date, index, { endsNextDay: e.target.checked || undefined })
                        }
                      />
                      {t.day.eventNextDay}
                    </label>

                    <input
                      dir="auto"
                      aria-label={t.day.eventTitle}
                      value={event.title}
                      maxLength={80}
                      onChange={(e) => patchEvent(date, index, { title: e.target.value })}
                      className="order-first w-full min-w-32 rounded-card border border-line px-2 py-1.5 text-sm text-ink sm:order-none sm:w-auto sm:flex-1 sm:text-xs"
                    />

                    <select
                      aria-label={t.day.spaceLabel}
                      value={event.spaceId ?? ''}
                      onChange={(e) => patchEvent(date, index, { spaceId: e.target.value || undefined })}
                      className="rounded-card border border-line px-2 py-1 text-xs text-ink"
                    >
                      <option value="">{t.day.noSpace}</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name}
                        </option>
                      ))}
                    </select>

                    {/*
                      ⚠️⚠️ ושם חלל שנקרא ולא נמצא ברשימה נאמר, ואינו נבלע.
                      בלי זה המסך אומר "בלי חלל" על אירוע שכתוב לידו "חלל
                      גדול", והמנהלת חושבת שהקריאה פספסה אותו. ⚠️ ומה שחסר
                      הוא החלל ברשימת הסלון, לא הקריאה. DOCS/PLANING/52
                    */}
                    {event.space && !event.spaceId && (
                      <span dir="auto" className="shrink-0 text-xs text-ink-faint">
                        {t.importImage.spaceRead(event.space)}
                      </span>
                    )}

                    <Button tone="danger" size="xs" onClick={() => skipAlways(event.title)}>
                      {t.importImage.skipAlways}
                    </Button>
                  </li>
                  );
                })}
              </ul>
            )}

            {nothingToDo ? (
              <span className="block text-xs text-ink-faint">{t.importImage.sameHint}</span>
            ) : (
              /*
                ⚠️⚠️ שני מישורים ולא רשימה אחת.

                קודם זו הייתה רשימה שטוחה, **והתגית "מצב היום לא משתנה" נראתה
                כסותרת את "שני אירועים יוסרו" שמתחתיה.** שניהם היו נכונים, כי
                מצב הגישה ורשימת האירועים הם שני דברים. DOCS/PLANING/56

                ⚠️ ומישור בלי שורות אינו מוצג, ולכן יום שמצב הגישה שלו אינו
                משתנה פשוט לא יראה את הכותרת ההיא. **וזו הסתירה שנעלמת.**
              */
              <div className="mt-1 flex flex-col gap-1">
                {PLANES.map((plane) => {
                  const lines = plan.changes.filter((change) => change.plane === plane);
                  if (lines.length === 0) return null;

                  return (
                    <div key={plane}>
                      <span className="text-xs font-medium text-ink-faint">
                        {PLANE_LABEL[plane]}
                      </span>
                      <ul className="flex flex-col gap-0.5">
                        {lines.map((change, index) => (
                          <li
                            key={`${change.kind}-${index}`}
                            className={
                              change.kind === 'erase'
                                ? 'text-xs font-medium text-danger'
                                : 'text-xs text-ink-soft'
                            }
                          >
                            {/* ⚠️ מילה ולא צבע לבד. CLAUDE.md, עיצוב. */}
                            {change.kind === 'erase' ? `${t.importImage.overwrites}: ` : ''}
                            {change.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </span>
        </label>
      </li>
    );
  }

  return (
    <Sheet
      title={t.importImage.title}
      onClose={close}
      footer={
        days && days.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button tone="primary" disabled={saving || chosenHere === 0} onClick={save}>
              {saving ? t.importImage.saving : t.importImage.save}
            </Button>

            {/* ⚠️ המונה ליד הכפתור, ולא בסוף גלילה ארוכה. */}
            <span className="text-xs text-ink-soft">
              {chosenHere > 0
                ? t.importImage.chosenCount(chosenHere)
                : conflictCount > 0
                  ? t.importImage.conflictHint
                  : t.importImage.nothingToSave}
            </span>

            {/* ⚠️ ומה שמסומן עכשיו ודורס, נאמר ליד הכפתור. */}
            {chosenConflicts > 0 && (
              <span className="text-xs font-medium text-danger">
                {t.importImage.approvingConflicts(chosenConflicts)}
              </span>
            )}
          </div>
        ) : undefined
      }
    >
      <p className="text-sm text-ink-soft">{t.importImage.lead(monthName)}</p>

      {/* ⚠️ בצהוב ולא באפור. התמונה יוצאת לשירות חיצוני, וזה צריך להיקרא. */}
      <p className="mt-2 rounded-card bg-shift-open px-3 py-2 text-xs leading-relaxed text-shift-open-ink">
        {t.importImage.sendsToGoogle}
      </p>

      <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-ink">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={reading || saving}
          onChange={(event) => onPick(event.target.files?.[0])}
        />
        {reading ? t.importImage.reading : days ? t.importImage.readAgain : t.importImage.pick}
      </label>

      {/*
        ⚠️⚠️ ומקור טקסט לצד מקור התמונה, בבקשת בעל המוצר 26/10: "לאפשר ייבוא
        אירועים מכל תמונה או טקסט". DOCS/PLANING/39

        ⚠️ ולא במקום התמונה: אותה מנהלת מצלמת לוח בחודש אחד ומדביקה מייל
        בחודש אחר.
      */}
      <div className="mt-3 rounded-card border border-line p-3">
        <label className="block">
          <span className="text-sm text-ink-soft">{t.importImage.textLabel}</span>
          <textarea
            dir="auto"
            rows={4}
            value={pasted}
            maxLength={MAX_TEXT_CHARS}
            disabled={reading || saving}
            placeholder={t.importImage.textPlaceholder}
            onChange={(event) => setPasted(event.target.value)}
            className="mt-1.5 w-full rounded-card border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button
            tone="secondary"
            disabled={reading || saving || !pasted.trim()}
            onClick={onReadText}
          >
            {reading ? t.importImage.reading : t.importImage.readText}
          </Button>
          <span className="text-xs text-ink-faint">{t.importImage.textHint}</span>
        </div>
      </div>

      {/*
        ⚠️⚠️ חיווי התקדמות, ולא מסך שנראה תקוע.
        בעל המוצר, 06/10: "כשאני מעלה תמונה אין איזה סטטוס מצב וזה נראה
        שבור". ⚠️ ושלוש מדרגות ולא פס אחוזים: אין כאן אחוז אמיתי, והמודל
        אינו מדווח התקדמות. DOCS/PLANING/26
      */}
      {stage && (
        <div role="status" aria-live="polite" className="mt-3 rounded-card bg-surface-sunken p-3">
          <div className="flex items-center gap-2">
            {/* ⚠️ מסתובב, וזה מה שאומר שהמערכת עובדת. */}
            <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand" />
            <span className="text-sm font-medium text-ink">{STAGE_LABEL[stage]}</span>
          </div>

          <ol className="mt-2 flex gap-1">
            {STAGES.map((item) => (
              <li
                key={item}
                aria-hidden="true"
                className={`h-1 flex-1 rounded-full ${
                  STAGES.indexOf(item) <= STAGES.indexOf(stage) ? 'bg-brand' : 'bg-line'
                }`}
              />
            ))}
          </ol>

          <p className="mt-2 text-xs text-ink-faint">{t.importImage.stageHint}</p>

          {/*
            ⚠️⚠️ ביטול, בבקשת בעל המוצר 28/10, ⚠️ ועם מה שהוא אינו יכול לבטל.

            **הקריאה בצד השרת ממשיכה והמודל מחויב**, כי `httpsCallable` אינו
            מקבל אות ביטול. **וזה נאמר ואינו מוסתר.** DOCS/PLANING/58
          */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button tone="secondary" size="sm" onClick={cancelRun}>
              {t.importImage.cancelReading}
            </Button>
            <span className="text-xs text-ink-faint">{t.importImage.cancelHint}</span>
          </div>
        </div>
      )}

      {/*
        ⚠️⚠️ "לא נמצא כלום" הוא תוצאה ולא הערה, מ-26/10/2026.

        בעל המוצר ייבא תמונה של נובמבר לתוך אוקטובר, קיבל אפס ימים, ושאל "איך
        המשתמש אמור להבין שזו השגיאה".

        ⚠️ וההודעה עצמה אמרה בדיוק את הדבר הנכון, והיא לא נגעה. מה שנגע הוא
        איך היא נראתה: פסקה אפורה בגודל טקסט רגיל, בלי מסגרת ובלי מילת מצב,
        **והמסך נקרא כאילו הייבוא הצליח.** DOCS/PLANING/52

        ⚠️ ומילה ולא צבע לבד. CLAUDE.md, עיצוב.
      */}
      {days && days.length === 0 && (
        /* ⚠️ ולוח של חודש אחר אינו "לא נמצא כלום": הוא נמצא, והמסך מציע לעבור. */
        <div
          role="status"
          className="mt-3 rounded-card bg-surface-sunken p-3 ring-1 ring-inset ring-line-strong"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="closed">{t.importImage.nothingFoundMark}</StatusPill>
            <span className="text-sm font-semibold text-ink">
              {t.importImage.nothingFoundTitle}
            </span>
          </div>
          {/* ⚠️⚠️ והנוסח הזה לא נגע. הוא אומר מה קרה, ומה לעשות עכשיו. */}
          <p className="mt-2 text-sm text-ink">{t.importImage.nothingFound(monthName)}</p>
        </div>
      )}

      {/*
        ⚠️⚠️ הלוח שהועלה הוא של חודש אחר, והמסך מציע לעבור אליו.

        **ובלי קריאה שנייה למודל:** מה שנקרא יושב ב-`days` שבתוך הרכיב,
        ⚠️ **והרכיב אינו נטען מחדש כשהחודש משתנה**, נמדד. ההפרדה והתוכניות
        נגזרות מחדש מאותם נתונים.

        ⚠️ ועד 27/10 הימים האלה לא הגיעו לכאן בכלל: ההנחיה ביקשה מהמודל להחזיר
        חודש אחד, והמסך אמר "נסו שוב". DOCS/PLANING/57
      */}
      {split && split.suggested && (
        <div className="mt-3 rounded-card bg-surface-sunken p-3 ring-1 ring-inset ring-line-strong">
          <p className="text-sm text-ink">
            {split.chosen.length === 0
              ? t.importImage.otherMonthOnly(monthNameOf(split.suggested), split.other.length)
              : t.importImage.otherMonthSome(monthNameOf(split.suggested), split.other.length)}
          </p>
          <div className="mt-2">
            <Button
              tone="action"
              size="sm"
              disabled={reading || saving}
              onClick={() => setMonthKey(split.suggested!)}
            >
              {t.importImage.goToMonth(monthNameOf(split.suggested))}
            </Button>
          </div>
        </div>
      )}

      {/*
        ⚠️ ואחרי מעבר חודש הלוח של החודש החדש עוד נטען.
        בלי ההמתנה הזאת הרשימה מציגה לרגע את כל הימים כ"יום חדש", כי הלוח
        שהיא משווה אליו עוד ריק. DOCS/PLANING/57
      */}
      {days && days.length > 0 && isMonthLoading && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          {t.importImage.loadingMonth}
        </p>
      )}

      {groups && split && split.chosen.length > 0 && !isMonthLoading && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {t.importImage.foundTitle(split.chosen.length)}
            </h3>
            {/*
              ⚠️⚠️ וקריאה חלקית אינה נראית כמו קריאה שלמה.

              נמדד בידי בעל המוצר, 26/10: תמונה עם 13 שורות החזירה יום אחד,
              **והמסך אמר "נמצא יום אחד" בלי שום סימן ש-12 שורות אבדו.**
              DOCS/PLANING/52

              ⚠️ ואין כאן מספר: המודל מחזיר את מה שקרא ואינו מדווח כמה היו
              במקור, ולכן אין מה להשוות. **מה שנאמר הוא מה שידוע**, שזו
              הקריאה ולא המקור, ושצריך להשוות אליו.
            */}
            <p className="mt-0.5 text-xs text-ink-faint">{t.importImage.compareToSource}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{t.importImage.fixAfter}</p>

            {/* ⚠️ מה שהושמט נאמר, כדי שלא ייראה כאילו המודל פספס אותו. */}
            {skippedCount > 0 && (
              <p className="mt-1 text-xs text-ink-faint">
                {t.importImage.skipped(skippedCount)}. {t.importImage.skippedHint}
              </p>
            )}
          </div>

          {groups.map((group) => {
            if (group.days.length === 0) return null;

            /*
              ⚠️⚠️ "סימון הכל" קיים רק לימים חדשים.
              כפתור שמסמן את כל הרשימה מבטל את ההכרעה של רשומה 25, שלפיה יום
              שדורס אינו מסומן מראש.
            */
            const canPickAll = group.verdict === 'new';
            const allPicked = group.days.every((day) => chosen.has(day.date));

            return (
              <section key={group.verdict}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={VERDICT_TONE[group.verdict]}>
                    {VERDICT_LABEL[group.verdict]}
                  </StatusPill>
                  <span className="num text-xs text-ink-faint">{group.days.length}</span>

                  {canPickAll && (
                    <Button
                      tone="quiet"
                      size="xs"
                      className="ms-auto text-brand"
                      onClick={() => {
                        const next = new Set(chosen);
                        for (const day of group.days) {
                          if (allPicked) next.delete(day.date);
                          else next.add(day.date);
                        }
                        setChosen(next);
                      }}
                    >
                      {allPicked ? t.importImage.pickNone : t.importImage.pickAllNew}
                    </Button>
                  )}
                </div>

                {/* ⚠️ "ללא שינוי" מקופל: הוא מונה, ואין בו מה לאשר. */}
                {group.verdict === 'same' ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-ink-soft">
                      {t.importImage.sameGroup(group.days.length)}
                    </summary>
                    <ul className="flex flex-col divide-y divide-line">
                      {group.days.map((day) => rowFor(day.date))}
                    </ul>
                  </details>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {group.days.map((day) => rowFor(day.date))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/*
        ⚠️⚠️ וכשל נראה כמו תוצאה גם הוא, באותה אמת מידה.

        `emptyAnswer`, "המודל לא החזיר תשובה", ו-`modelFailed` נמדדו כקיימים
        במילון, **ולא נמדד איך הם מוצגים:** הם היו שורת טקסט אדומה בגודל רגיל,
        בלי מסגרת, בדיוק כמו "לא נמצא כלום". DOCS/PLANING/52

        ⚠️ ובלי כותרת שאני ממציא: אותו מצב נושא גם כשל קריאה וגם כשל שמירה,
        ואין משפט אחד שנכון לשניהם. ההודעה עצמה אומרת מה קרה.
      */}
      {problem && (
        <div
          role="alert"
          className="mt-3 rounded-card bg-surface-sunken p-3 ring-1 ring-inset ring-danger"
        >
          <p className="text-sm font-medium text-danger">{problem}</p>
        </div>
      )}
    </Sheet>
  );
}
