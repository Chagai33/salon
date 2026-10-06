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
import { dayAccessOf } from '../../utils/hebrew';
import { planFor } from '../../utils/importDiff';
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
}: {
  branchId: string;
  monthKey: string;
  /** ⚠️ מה שכבר כתוב בלוח. בלעדיו אין דרך לדעת מה הייבוא מחליף. */
  activityByDate: Map<string, ActivityDay>;
}) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [days, setDays] = useState<ImportedDay[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

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
      .then((found) => {
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-card border border-line px-4 py-2.5 text-sm text-ink hover:bg-brand-soft"
      >
        {t.importImage.title}
      </button>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-soft">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{t.importImage.title}</h2>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-sm text-ink-soft underline-offset-4 hover:underline"
        >
          {t.importImage.cancel}
        </button>
      </header>

      <p className="mt-1.5 text-sm text-ink-soft">{t.importImage.lead(monthName)}</p>

      {/* ⚠️ בצהוב ולא באפור. התמונה יוצאת לשירות חיצוני, וזה צריך להיקרא. */}
      <p className="mt-2 rounded-card bg-shift-open px-3 py-2 text-xs leading-relaxed text-shift-open-ink">
        {t.importImage.sendsToGoogle}
      </p>

      <label className="mt-3 inline-flex cursor-pointer items-center rounded-card bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">
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

      {days && days.length > 0 && plans && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">
            {t.importImage.foundTitle(days.length)}
          </h3>
          <p className="mt-0.5 text-xs text-ink-faint">{t.importImage.reviewHint}</p>
          {/* ⚠️ ובעל המוצר ביקש במפורש שיהיה אפשר לתקן אחרי הייבוא. זה המקום
              שבו הוא נאמר, כדי שלא יחפש. */}
          <p className="mt-0.5 text-xs text-ink-faint">{t.importImage.fixAfter}</p>

          {/* ⚠️⚠️ וההתנגשויות נאמרות לפני הרשימה, כדי שלא יתגלו בגלילה. */}
          {conflictCount > 0 && (
            <p className="mt-2 rounded-card bg-shift-open px-3 py-2 text-xs leading-relaxed text-shift-open-ink">
              {t.importImage.conflictSummary(conflictCount)}
            </p>
          )}

          <ul className="mt-2 flex flex-col divide-y divide-line">
            {days.map((day) => {
              const plan = plans.get(day.date);
              if (!plan) return null;
              // ⚠️ יום שאין בו מה לשנות אינו ניתן לסימון. אין מה לאשר.
              const nothingToDo = plan.verdict === 'same';

              return (
                <li key={day.date} className="py-2">
                  <label
                    className={`flex items-start gap-2.5 ${nothingToDo ? '' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={nothingToDo}
                      checked={chosen.has(day.date)}
                      onChange={(event) => {
                        const next = new Set(chosen);
                        if (event.target.checked) next.add(day.date);
                        else next.delete(day.date);
                        setChosen(next);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">
                          {shortDateLabel(day.date)}
                        </span>
                        <StatusPill tone={VERDICT_TONE[plan.verdict]}>
                          {VERDICT_LABEL[plan.verdict]}
                        </StatusPill>
                        {/* ⚠️ "מצב היום לא משתנה". מה שכן משתנה מפורט למטה. */}
                        {day.access === 'unknown' && (
                          <StatusPill tone="taken">{t.importImage.accessUnknown}</StatusPill>
                        )}
                        {day.confidence < LOW_CONFIDENCE && (
                          <StatusPill tone="open">{t.importImage.lowConfidence}</StatusPill>
                        )}
                      </span>

                      {nothingToDo ? (
                        <span className="block text-xs text-ink-faint">
                          {t.importImage.sameHint}
                        </span>
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
            })}
          </ul>

          {/* ⚠️ ומה שמסומן עכשיו ומחליף, נאמר ליד הכפתור ולא רחוק ממנו. */}
          {chosenConflicts > 0 && (
            <p className="mt-3 text-xs font-medium text-danger">
              {t.importImage.approvingConflicts(chosenConflicts)}
            </p>
          )}

          <button
            type="button"
            disabled={saving || chosen.size === 0}
            onClick={save}
            className="mt-2 rounded-card bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50"
          >
            {saving ? t.importImage.saving : t.importImage.save}
          </button>

          {chosen.size === 0 && (
            <p className="mt-1.5 text-xs text-ink-faint">
              {conflictCount > 0 ? t.importImage.conflictHint : t.importImage.nothingToSave}
            </p>
          )}
        </div>
      )}

      {problem && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {problem}
        </p>
      )}
    </section>
  );
}
