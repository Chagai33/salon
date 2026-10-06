// src/components/admin/ImportBoardImage.tsx
//
// המנהלת מעלה צילום של הלוח, רואה מה נקרא, מסמנת מה נכון, ושומרת.
//
// ⚠️⚠️ ואין כאן "ייבוא". יש קריאה, אישור, ואז כתיבה.
// CLAUDE.md, אזור ליבה 4: הייבוא כותב מידע על ימים אמיתיים, ולכן מודל אינו
// כותב למסד. הוא מציע, והמנהלת מכריעה על כל יום בנפרד.
//
// ⚠️ ושורת "התמונה נשלחת לגוגל" אינה אופציונלית. זו הודעה בנקודת האיסוף.

import { useMemo, useState } from 'react';
import { t } from '../../i18n/dictionary';
import { shortDateLabel } from '../../utils/dates';
import { monthNameOf } from '../../utils/dates';
import { saveActivityDay } from '../../services/salonService';
import { readBoardImage } from '../../services/importService';
import type { ImportedAccess, ImportedDay } from '../../services/importService';
import { toReadableError } from '../../utils/errors';
import { StatusPill } from '../common/StatusPill';
import { dayAccessOf } from '../../utils/hebrew';

/** ⚠️ קריאה מתחת לזה מסומנת למנהלת. 0.7 הוא שיקול ולא מדידה. */
const LOW_CONFIDENCE = 0.7;

const TO_FIELDS = {
  open: { publicAccess: 'open', memberAccess: 'open' },
  membersOnly: { publicAccess: 'closed', memberAccess: 'open' },
  closed: { publicAccess: 'closed', memberAccess: 'closed' },
} as const;

/**
 * ⚠️⚠️ מצב שלא נקרא מהתמונה נגזר מהכלל, ואינו נכתב כ"פתוח לכולם".
 *
 * `dayAccessOf` בלי רשומה מחזיר את ברירת המחדל: שישי ושבת סגורים לציבור
 * ופתוחים לחברים, ושאר הימים פתוחים. זה מה שהמוצר אומר ממילא, ולכן הייבוא
 * אינו משנה כלום כשהתמונה שותקת.
 */
function fieldsFor(day: ImportedDay) {
  if (day.access !== 'unknown') return TO_FIELDS[day.access];
  const derived = dayAccessOf(day.date, undefined, undefined);
  return { publicAccess: derived.publicAccess, memberAccess: derived.memberAccess };
}

const ACCESS_LABEL: Record<ImportedAccess, string> = {
  unknown: t.importImage.accessUnknown,
  open: t.day.accessOpen,
  membersOnly: t.day.accessMembersOnly,
  closed: t.day.accessClosed,
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
    notJson: t.importImage.modelFailed,
    memberLookupFailed: t.importImage.memberLookupFailed,
    unexpected: t.importImage.unexpected,
  };
  return known[code] ?? t.importImage.modelFailed;
}

export function ImportBoardImage({ branchId, monthKey }: { branchId: string; monthKey: string }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [days, setDays] = useState<ImportedDay[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const monthName = useMemo(() => monthNameOf(monthKey), [monthKey]);

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
        // ⚠️ מסומן מראש רק מה שנקרא בבירור. השאר דורש החלטה מפורשת.
        setChosen(new Set(found.filter((d) => d.confidence >= LOW_CONFIDENCE).map((d) => d.date)));
      })
      .catch((error: unknown) => setProblem(messageFor(error)))
      .finally(() => setReading(false));
  }

  function save() {
    if (!days) return;
    const picked = days.filter((day) => chosen.has(day.date));
    setSaving(true);
    setProblem(null);
    void Promise.all(
      picked.map((day) =>
        saveActivityDay(branchId, {
          date: day.date,
          events: day.events,
          ...fieldsFor(day),
          note: day.note,
          // ⚠️ `source` הוא מה שמאפשר לדעת אחר כך מה בא ממודל ומה מאדם.
          source: 'import2026',
        }),
      ),
    )
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

      {days && days.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">
            {t.importImage.foundTitle(days.length)}
          </h3>
          <p className="mt-0.5 text-xs text-ink-faint">{t.importImage.reviewHint}</p>
          {/* ⚠️ ובעל המוצר ביקש במפורש שיהיה אפשר לתקן אחרי הייבוא. זה המקום
              שבו הוא נאמר, כדי שלא יחפש. */}
          <p className="mt-0.5 text-xs text-ink-faint">{t.importImage.fixAfter}</p>

          <ul className="mt-2 flex flex-col divide-y divide-line">
            {days.map((day) => (
              <li key={day.date} className="py-2">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-1"
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
                      <StatusPill tone={day.access === 'unknown' ? 'taken' : 'membersOnly'}>
                        {ACCESS_LABEL[day.access]}
                      </StatusPill>
                      {day.confidence < LOW_CONFIDENCE && (
                        <StatusPill tone="open">{t.importImage.lowConfidence}</StatusPill>
                      )}
                    </span>
                    {day.note && <span className="block text-sm text-ink-soft">{day.note}</span>}
                    {day.events.length > 0 && (
                      <span className="block text-xs text-activity">
                        {day.events
                          .map((e) => (e.startTime ? `${e.title} ${e.startTime}` : e.title))
                          .join(' · ')}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={saving || chosen.size === 0}
            onClick={save}
            className="mt-3 rounded-card bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50"
          >
            {saving ? t.importImage.saving : t.importImage.save}
          </button>
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
