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
// ⚠️ ולכן יום שמחליף משהו קיים אינו מסומן מראש, בשום רמת ביטחון.

import { useMemo, useState } from 'react';
import { t } from '../../i18n/dictionary';
import { shortDateLabel } from '../../utils/dates';
import { monthNameOf } from '../../utils/dates';
import { mergeActivityDay } from '../../services/salonService';
import { readBoardImage } from '../../services/importService';
import type { ImportedDay } from '../../services/importService';
import { toReadableError } from '../../utils/errors';
import { StatusPill } from '../common/StatusPill';
import { Sheet } from '../common/Sheet';
import { dayAccessOf } from '../../utils/hebrew';
import { planFor } from '../../utils/importDiff';
import { useStore } from '../../store/useStore';
import { saveBranchSettings } from '../../services/salonService';
import type { DayPlan, DayVerdict } from '../../utils/importDiff';
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
    noAuth: t.importImage.noToken,
    emptyAnswer: t.importImage.emptyAnswer,
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
}: {
  branchId: string;
  monthKey: string;
  /** ⚠️ מה שכבר כתוב בלוח. בלעדיו אין דרך לדעת מה הייבוא מחליף. */
  activityByDate: Map<string, ActivityDay>;
  /**
   * ⚠️ פתיחת היום לעריכה, בבקשת בעל המוצר 06/10: "לאפשר למנהלת לפתוח את
   * האירועים שהיא ייבאה מהתמונה בדיוק כמו שהיא עורכת שיבוצים וימים".
   * מודל שקורא תמונה טועה בכותרת ובשעה, והתיקון במרחק לחיצה מהשורה שבה
   * הטעות נראית. DOCS/PLANING/26
   */
  onOpenDay: (dateKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [days, setDays] = useState<ImportedDay[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** כמה אירועים הושמטו לפי מאגר הדילוג של הסלון. */
  const [skippedCount, setSkippedCount] = useState(0);

  const branch = useStore((state) => state.branch);
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

  const monthName = useMemo(() => monthNameOf(monthKey), [monthKey]);

  /*
    ⚠️ ב-useMemo ולא בבורר ולא בגוף הרכיב. `planFor` בונה אובייקט חדש בכל
    קריאה. CLAUDE.md, זרימת נתונים.
  */
  const plans = useMemo(() => {
    if (!days) return null;
    const byDate = new Map<string, DayPlan>();
    for (const day of days) {
      byDate.set(day.date, planFor(day, activityByDate.get(day.date), fallbackFor(day.date)));
    }
    return byDate;
  }, [days, activityByDate]);

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
    setSavedCount(null);
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    reset();
    setReading(true);
    void readBoardImage(file, branchId, monthKey)
      .then((raw) => {
        /*
          ⚠️ מה שבמאגר הדילוג אינו נכנס לרשימה בכלל.
          הוא גם אינו נכתב למסד, ⚠️ והמנהלת רואה כמה הושמטו כדי שלא תחשוב
          שהמודל פספס אותם. DOCS/PLANING/26
        */
        let skipped = 0;
        const found = raw.map((day) => {
          const events = day.events.filter((event) => !ignored.has(normalizeTitle(event.title)));
          skipped += day.events.length - events.length;
          return { ...day, events };
        });
        setSkippedCount(skipped);
        setDays(found);
        /*
          ⚠️⚠️ מסומן מראש רק מה שאינו מוחק כלום.

          שני תנאים, ושניהם נדרשים: קריאה ברורה, **ויום שאינו מחליף מה שכבר
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
                ).verdict;
                return verdict === 'new' || verdict === 'adds';
              })
              .map((day) => day.date),
          ),
        );
      })
      .catch((error: unknown) => setProblem(messageFor(error)))
      .finally(() => setReading(false));
  }

  function save() {
    if (!days || !plans) return;
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
    void Promise.all(picked.map((plan) => mergeActivityDay(branchId, plan.fields)))
      .then(() => {
        setSavedCount(picked.length);
        setDays(null);
        setChosen(new Set());
      })
      .catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)))
      .finally(() => setSaving(false));
  }


  /*
    ⚠️⚠️ מקובץ, ובסדר הזה: מה שמחליף קודם.
    הרשימה הקודמת הייתה רצף של עשרים שורות בתוך עמוד שגם הוא נגלל, ומה שמחליף
    התגלה בגלילה. DOCS/PLANING/26
  */
  const groups = useMemo(() => {
    if (!days || !plans) return null;
    const order: DayVerdict[] = ['conflict', 'new', 'adds', 'same'];
    return order.map((verdict) => ({
      verdict,
      days: days.filter((day) => plans.get(day.date)?.verdict === verdict),
    }));
  }, [days, plans]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-card border border-line px-4 text-sm text-ink hover:bg-brand-soft"
      >
        {t.importImage.title}
      </button>
    );
  }

  function close() {
    reset();
    setOpen(false);
  }

  /** שיוך חלל לאירוע, עוד לפני השמירה. ⚠️ משנה את מה שייכתב, לא רק את התצוגה. */
  function setEventSpace(date: string, index: number, spaceId: string | undefined) {
    setDays(
      (current) =>
        current?.map((day) =>
          day.date === date
            ? {
                ...day,
                events: day.events.map((event, i) =>
                  i === index ? { ...event, spaceId } : event,
                ),
              }
            : day,
        ) ?? null,
    );
  }

  /*
    ⚠️ מוסיף למאגר הדילוג של הסלון, ומסיר את האירוע מכל הימים ברשימה.
    בלשון בעל המוצר, 06/10: "אירועים חוזרים שאינם מתקיימים בסלון או לא
    רלוונטיים אליו". חוזר פירושו שהוא יחזור גם בייבוא הבא. DOCS/PLANING/26
  */
  function skipAlways(title: string) {
    if (!branch) return;
    const key = normalizeTitle(title);
    void saveBranchSettings(branchId, {
      importIgnore: [...(branch.importIgnore ?? []), title.trim()],
    }).catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)));

    let removed = 0;
    setDays(
      (current) =>
        current?.map((day) => {
          const events = day.events.filter((event) => normalizeTitle(event.title) !== key);
          removed += day.events.length - events.length;
          return { ...day, events };
        }) ?? null,
    );
    setSkippedCount((count) => count + removed);
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
              <button
                type="button"
                onClick={() => onOpenDay(date)}
                className="text-xs text-brand underline-offset-4 hover:underline"
              >
                {t.importImage.openDay}
              </button>
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
                {day.events.map((event, index) => (
                  <li key={index} className="flex flex-wrap items-center gap-2">
                    <span className="num w-11 shrink-0 text-xs text-ink-faint">
                      {event.startTime ?? ''}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-activity">
                      {event.title}
                    </span>

                    <select
                      aria-label={t.day.spaceLabel}
                      value={event.spaceId ?? ''}
                      onChange={(e) => setEventSpace(date, index, e.target.value || undefined)}
                      className="rounded-card border border-line px-2 py-1 text-xs text-ink"
                    >
                      <option value="">{t.day.noSpace}</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => skipAlways(event.title)}
                      className="text-xs text-danger underline-offset-4 hover:underline"
                    >
                      {t.importImage.skipAlways}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {nothingToDo ? (
              <span className="block text-xs text-ink-faint">{t.importImage.sameHint}</span>
            ) : (
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {plan.changes.map((change, index) => (
                  <li
                    key={`${change.kind}-${index}`}
                    className={
                      change.kind === 'erase'
                        ? 'text-xs font-medium text-danger'
                        : 'text-xs text-ink-soft'
                    }
                  >
                    {/* ⚠️ מילה ולא צבע לבד. CLAUDE.md, עיצוב. */}
                    {change.kind === 'erase' ? 'מחליף: ' : ''}
                    {change.text}
                  </li>
                ))}
              </ul>
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
            <button
              type="button"
              disabled={saving || chosen.size === 0}
              onClick={save}
              className="min-h-11 rounded-card bg-brand px-4 text-sm font-semibold text-brand-ink disabled:opacity-50"
            >
              {saving ? t.importImage.saving : t.importImage.save}
            </button>

            {/* ⚠️ המונה ליד הכפתור, ולא בסוף גלילה ארוכה. */}
            <span className="text-xs text-ink-soft">
              {chosen.size > 0
                ? t.importImage.chosenCount(chosen.size)
                : conflictCount > 0
                  ? t.importImage.conflictHint
                  : t.importImage.nothingToSave}
            </span>

            {/* ⚠️ ומה שמסומן עכשיו ומחליף, נאמר ליד הכפתור. */}
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

      <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-card bg-brand px-4 text-sm font-semibold text-brand-ink">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={reading || saving}
          onChange={(event) => onPick(event.target.files?.[0])}
        />
        {reading ? t.importImage.reading : days ? t.importImage.readAgain : t.importImage.pick}
      </label>

      {savedCount !== null && (
        <p role="status" className="mt-3 text-sm text-shift-mine-ink">
          {t.importImage.saved(savedCount)}
        </p>
      )}

      {days && days.length === 0 && (
        <p className="mt-3 text-sm text-ink-soft">{t.importImage.nothingFound}</p>
      )}

      {groups && days && days.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {t.importImage.foundTitle(days.length)}
            </h3>
            {/* ⚠️ ובעל המוצר ביקש במפורש שיהיה אפשר לתקן אחרי הייבוא. */}
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
              שמחליף אינו מסומן מראש.
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
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(chosen);
                        for (const day of group.days) {
                          if (allPicked) next.delete(day.date);
                          else next.add(day.date);
                        }
                        setChosen(next);
                      }}
                      className="ms-auto min-h-9 px-2 text-xs text-brand underline-offset-4 hover:underline"
                    >
                      {allPicked ? t.importImage.pickNone : t.importImage.pickAllNew}
                    </button>
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

      {problem && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {problem}
        </p>
      )}
    </Sheet>
  );
}
