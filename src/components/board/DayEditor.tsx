// src/components/board/DayEditor.tsx
//
// המנהלת כותבת הערה קצרה ליום, וקובעת מי יכול להיות בסלון.
//
// ⚠️ עורך אחד מתחת ללוח, ולא טופס בכל תא. שלושים ואחד טפסים בתוך לוח חודש הם
// שלושים ואחד שדות שאיש אינו רואה, והתא בלוח צר מדי לכתוב בו.
//
// ⚠️⚠️ ומה שנכתב כאן מנצח את שם החג. `dayAccessOf` נותן קדימות למה שהמנהלת
// כתבה, ושם החג הוא מידע בלבד. DOCS/PLANING/14-the-hebrew-calendar.md

import { useEffect, useState } from 'react';
import type { ActivityDay, MemberAccess, PublicAccess } from '../../types';
import { t } from '../../i18n/dictionary';
import { WEEKDAY_NAMES, shortDateLabel, weekdayOf } from '../../utils/dates';
import { saveActivityDay } from '../../services/salonService';
import { toReadableError } from '../../utils/errors';

/** שלוש האפשרויות, ולא שני שדות נפרדים שאפשר לסתור זה את זה. */
type Access = 'open' | 'membersOnly' | 'closed';

const TO_FIELDS: Record<Access, { publicAccess: PublicAccess; memberAccess: MemberAccess }> = {
  open: { publicAccess: 'open', memberAccess: 'open' },
  membersOnly: { publicAccess: 'closed', memberAccess: 'open' },
  closed: { publicAccess: 'closed', memberAccess: 'closed' },
};

function accessOf(day: ActivityDay | undefined): Access {
  if (!day) return 'open';
  if (day.memberAccess === 'closed') return 'closed';
  if (day.publicAccess === 'closed') return 'membersOnly';
  return 'open';
}

interface Props {
  branchId: string;
  dateKey: string;
  day: ActivityDay | undefined;
  /** שם החג, אם יש. מוצג כהקשר להחלטה. */
  name?: string;
  onClose: () => void;
}

export function DayEditor({ branchId, dateKey, day, name, onClose }: Props) {
  const [access, setAccess] = useState<Access>(() => accessOf(day));
  const [note, setNote] = useState(day?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // ⚠️ מעבר ליום אחר מרענן את השדות. בלי זה ההערה של יום אחד נדבקת לשני.
  useEffect(() => {
    setAccess(accessOf(day));
    setNote(day?.note ?? '');
    setProblem(null);
  }, [dateKey, day]);

  const options: { value: Access; label: string }[] = [
    { value: 'open', label: t.day.accessOpen },
    { value: 'membersOnly', label: t.day.accessMembersOnly },
    { value: 'closed', label: t.day.accessClosed },
  ];

  function save() {
    setBusy(true);
    setProblem(null);
    void saveActivityDay(branchId, {
      date: dateKey,
      events: day?.events ?? [],
      ...TO_FIELDS[access],
      // ⚠️ הערה ריקה נשמרת כריקה ולא נמחקת מהמסמך, כדי שמחיקה תעבוד.
      note: note.trim(),
      closesAt: day?.closesAt,
      source: 'app',
    })
      .then(onClose)
      .catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)))
      .finally(() => setBusy(false));
  }

  return (
    <section className="border-t border-line p-4" aria-label={t.day.editDay}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          {WEEKDAY_NAMES[weekdayOf(dateKey)]}, {shortDateLabel(dateKey)}
          {name && <span className="ms-2 font-medium text-activity">{name}</span>}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-ink-soft underline-offset-4 hover:underline"
        >
          {t.day.closeEditor}
        </button>
      </header>

      <fieldset className="mt-3">
        <legend className="text-sm text-ink-soft">{t.day.accessLabel}</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-card border px-3 py-1.5 text-sm ${
                access === option.value
                  ? 'border-brand bg-brand-soft text-ink'
                  : 'border-line text-ink-soft hover:bg-brand-soft'
              }`}
            >
              <input
                type="radio"
                name="day-access"
                className="sr-only"
                checked={access === option.value}
                onChange={() => setAccess(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block">
        <span className="text-sm text-ink-soft">{t.day.noteLabel}</span>
        {/* ⚠️ dir="auto" ו-maxLength: הערה קצרה, ולא מסמך. */}
        <input
          dir="auto"
          value={note}
          maxLength={120}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.day.notePlaceholder}
          className="mt-1.5 w-full rounded-card border border-line-strong bg-surface px-3 py-2 text-ink"
        />
      </label>

      <p className="mt-2 text-xs text-ink-faint">{t.day.namedDayHint}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-card bg-brand px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-50"
        >
          {busy ? t.day.noteSaving : t.day.noteSave}
        </button>
        {note && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setNote('')}
            className="rounded-card px-3 py-2 text-sm text-ink-soft hover:underline"
          >
            {t.day.noteClear}
          </button>
        )}
      </div>

      {problem && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {problem}
        </p>
      )}
    </section>
  );
}
