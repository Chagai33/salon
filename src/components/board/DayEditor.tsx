// src/components/board/DayEditor.tsx
//
// המנהלת כותבת הערה קצרה ליום, מסמנת חריג בשעות, ועורכת את האירועים.
//
// ⚠️ עורך אחד בגיליון היום, ולא טופס בכל תא. שלושים ואחד טפסים בתוך לוח חודש
// הם שלושים ואחד שדות שאיש אינו רואה, והתא בלוח צר מדי לכתוב בו.
//
// ⚠️⚠️ ומה שנכתב כאן מנצח את שם החג. `dayAccessOf` נותן קדימות למה שהמנהלת
// כתבה, ושם החג הוא מידע בלבד. DOCS/PLANING/14-the-hebrew-calendar.md
//
// ⚠️⚠️ ואין כאן "מי יכול להיות בסלון".
// בלשון בעל המוצר, 06/10: "כשהסלון פתוח הוא פתוח לכולם, בשאר הזמן הסלון סגור
// חוץ מלחברי האופן ספייס". זה כלל קבוע ואינו בחירה ליום, ולכן השאלה היחידה
// ליום היא אם הוא חורג מהשעות הרגילות. DOCS/PLANING/26

import { useEffect, useState } from 'react';
import type { ActivityDay, ActivityEvent, MemberAccess, PublicAccess } from '../../types';
import { t } from '../../i18n/dictionary';
import { WEEKDAY_NAMES, shortDateLabel, weekdayOf } from '../../utils/dates';
import { saveActivityDay, saveBranchSettings } from '../../services/salonService';
import { useStore } from '../../store/useStore';
import { toReadableError } from '../../utils/errors';

/** ארבעת החריגים, ולא שני שדות נפרדים שאפשר לסתור זה את זה. */
type Exception = 'none' | 'closesEarly' | 'closed' | 'shut';

/*
  ⚠️ בשלושת הראשונים `memberAccess` הוא `open`.
  חבר אופן ספייס יכול להיות בסלון גם כשהוא סגור לציבור, וזה הלב של המוצר.

  ⚠️⚠️ והרביעי הוא היוצא מן הכלל, בבקשת בעל המוצר 06/10: "שהמנהלת תוכל לקבוע
  אם הסלון סגור גם לחברי האופן ספייס, ושבמידה וכך אז אין אפשרות להשתבץ
  למשמרת". ואין לו משמרת, כי אין על מה לשמור. DOCS/PLANING/26
*/
const TO_FIELDS: Record<Exception, { publicAccess: PublicAccess; memberAccess: MemberAccess }> = {
  none: { publicAccess: 'open', memberAccess: 'open' },
  closesEarly: { publicAccess: 'closesEarly', memberAccess: 'open' },
  closed: { publicAccess: 'closed', memberAccess: 'open' },
  shut: { publicAccess: 'closed', memberAccess: 'closed' },
};

function exceptionOf(day: ActivityDay | undefined): Exception {
  if (!day) return 'none';
  if (day.memberAccess === 'closed') return 'shut';
  if (day.publicAccess === 'closed') return 'closed';
  if (day.publicAccess === 'closesEarly') return 'closesEarly';
  return 'none';
}

interface Props {
  branchId: string;
  dateKey: string;
  day: ActivityDay | undefined;
  /** שם החג, אם יש. מוצג כהקשר להחלטה. */
  name?: string;
  /** ⚠️ בתוך גיליון היום הכותרת כבר קיימת, ולכן העורך אינו כותב אותה שוב. */
  bare?: boolean;
  onClose: () => void;
}

export function DayEditor({ branchId, dateKey, day, name, bare = false, onClose }: Props) {
  const branch = useStore((state) => state.branch);
  const [exception, setException] = useState<Exception>(() => exceptionOf(day));
  const [closesAt, setClosesAt] = useState(day?.closesAt ?? '');
  const [note, setNote] = useState(day?.note ?? '');
  /*
    ⚠️ האירועים נערכים כאן, ובעל המוצר ביקש את זה במפורש אחרי שראה את הייבוא:
    "חשוב שאחרי הייבוא של האירועים מהתמונה שיהיה ניתן לתקן."
    מודל שקורא תמונה טועה בכותרת ובשעה, ובלי עריכה הטעות נשארת במסד.
  */
  const [events, setEvents] = useState<ActivityEvent[]>(() => day?.events ?? []);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** ⚠️ שם חלל חדש. null פירושו שהשדה סגור. */
  const [newSpace, setNewSpace] = useState<string | null>(null);
  const [savingSpace, setSavingSpace] = useState(false);

  // ⚠️ מעבר ליום אחר מרענן את השדות. בלי זה ההערה של יום אחד נדבקת לשני.
  useEffect(() => {
    setException(exceptionOf(day));
    setClosesAt(day?.closesAt ?? '');
    setNote(day?.note ?? '');
    setEvents(day?.events ?? []);
    setProblem(null);
  }, [dateKey, day]);

  const spaces = (branch?.spaces ?? []).filter((space) => space.isActive);

  function patchEvent(index: number, patch: Partial<ActivityEvent>) {
    setEvents(events.map((event, i) => (i === index ? { ...event, ...patch } : event)));
  }

  /** ⚠️ שעה ריקה נשמרת כ-undefined ולא כמחרוזת ריקה. אחרת הלוח מציג `-`. */
  function timeOrNone(value: string): string | undefined {
    return /^\d{2}:\d{2}$/.test(value) ? value : undefined;
  }

  const options: { value: Exception; label: string }[] = [
    { value: 'none', label: t.day.exceptionNone },
    { value: 'closesEarly', label: t.day.exceptionEarly },
    { value: 'closed', label: t.day.exceptionClosed },
    { value: 'shut', label: t.day.exceptionShut },
  ];

  /** ⚠️ החלל הוא ישות על הסניף, והמנהלת עורכת את הרשימה. DOCS/GLOSSARY.md */
  function addSpace() {
    const label = (newSpace ?? '').trim();
    if (!label || !branch) return;
    setSavingSpace(true);
    const id = crypto.randomUUID();
    void saveBranchSettings(branchId, {
      // ⚠️ order בסוף הרשימה. הוא קובע את סדר התצוגה, ואינו אופציונלי.
      spaces: [
        ...(branch.spaces ?? []),
        { id, name: label, isActive: true, order: (branch.spaces ?? []).length },
      ],
    })
      .then(() => setNewSpace(null))
      .catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)))
      .finally(() => setSavingSpace(false));
  }

  function save() {
    setBusy(true);
    setProblem(null);
    void saveActivityDay(branchId, {
      date: dateKey,
      // ⚠️ אירוע בלי כותרת נזרק. שורה ריקה שנשארה בטופס אינה אירוע.
      events: events
        .filter((event) => event.title.trim())
        .map((event) => ({ ...event, title: event.title.trim() })),
      ...TO_FIELDS[exception],
      // ⚠️ הערה ריקה נשמרת כריקה ולא נמחקת מהמסמך, כדי שמחיקה תעבוד.
      note: note.trim(),
      /*
        ⚠️⚠️ ושעת סגירה קיימת רק כשהחריג הוא סגירה מוקדמת.
        אחרת נוצר יום "פתוח כרגיל" שנושא שעת סגירה שאיש לא ביקש, וזה בדיוק
        המצב הלא עקבי שנמדד ב-DOCS/PLANING/25.
      */
      closesAt:
        exception === 'closesEarly' || exception === 'shut' ? timeOrNone(closesAt) : undefined,
      source: 'app',
    })
      .then(onClose)
      .catch((error: unknown) => setProblem(toReadableError(error, t.errors.saveFailed)))
      .finally(() => setBusy(false));
  }

  const field = 'rounded-card border border-line-strong bg-surface px-3 py-2 text-ink';

  return (
    <section
      className={bare ? 'border-t border-line pt-4' : 'border-t border-line p-4'}
      aria-label={t.day.editDay}
    >
      {!bare && (
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
      )}

      <fieldset className="mt-3">
        <legend className="text-sm text-ink-soft">{t.day.exceptionLabel}</legend>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-card border px-3 py-1.5 text-sm ${
                exception === option.value
                  ? 'border-brand bg-brand-soft text-ink'
                  : 'border-line text-ink-soft hover:bg-brand-soft'
              }`}
            >
              <input
                type="radio"
                name="day-exception"
                className="sr-only"
                checked={exception === option.value}
                onChange={() => setException(option.value)}
              />
              {option.label}
            </label>
          ))}

          {/* ⚠️ השעה מופיעה רק כשהיא רלוונטית, ולא כשדה ריק שתמיד שם. */}
          {(exception === 'closesEarly' || exception === 'shut') && (
            <label className="flex items-center gap-1.5 text-sm text-ink-soft">
              {exception === 'shut' ? t.day.exceptionFrom : t.day.exceptionAt}
              <input
                type="time"
                value={closesAt}
                onChange={(event) => setClosesAt(event.target.value)}
                className={`num ${field}`}
              />
            </label>
          )}
        </div>

        {/* ⚠️ מה שהחריג הזה עושה נאמר לידו, כי הוא מוחק את האפשרות להשתבץ. */}
        <p className="mt-1.5 text-xs text-ink-faint">
          {exception === 'shut' ? t.day.exceptionShutHint : t.day.exceptionHint}
        </p>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm text-ink-soft">{t.day.eventsLabel}</legend>

        {events.length === 0 && <p className="mt-1.5 text-sm text-ink-faint">{t.day.noEvents}</p>}

        <ul className="mt-1.5 flex flex-col gap-2">
          {events.map((event, index) => (
            <li key={index} className="flex flex-wrap items-end gap-2">
              <label className="min-w-48 flex-1">
                <span className="block text-xs text-ink-faint">{t.day.eventTitle}</span>
                <input
                  dir="auto"
                  value={event.title}
                  maxLength={80}
                  onChange={(e) => patchEvent(index, { title: e.target.value })}
                  className={`mt-1 w-full ${field}`}
                />
              </label>

              {/* ⚠️ לאירוע יש חלל, ולמשמרת אין. DOCS/GLOSSARY.md */}
              <label>
                <span className="block text-xs text-ink-faint">{t.day.spaceLabel}</span>
                <select
                  value={event.spaceId ?? ''}
                  onChange={(e) => patchEvent(index, { spaceId: e.target.value || undefined })}
                  className={`mt-1 ${field}`}
                >
                  <option value="">{t.day.noSpace}</option>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="block text-xs text-ink-faint">{t.day.eventFrom}</span>
                {/* ⚠️ type="time" נותן שעון 24 שעות ומקלדת מספרים בטלפון. */}
                <input
                  type="time"
                  value={event.startTime ?? ''}
                  onChange={(e) => patchEvent(index, { startTime: timeOrNone(e.target.value) })}
                  className={`num mt-1 ${field}`}
                />
              </label>
              <label>
                <span className="block text-xs text-ink-faint">{t.day.eventTo}</span>
                <input
                  type="time"
                  value={event.endTime ?? ''}
                  onChange={(e) => patchEvent(index, { endTime: timeOrNone(e.target.value) })}
                  className={`num mt-1 ${field}`}
                />
              </label>
              <button
                type="button"
                onClick={() => setEvents(events.filter((_, i) => i !== index))}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-danger underline-offset-4 hover:underline"
              >
                {t.day.removeEvent}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEvents([...events, { title: '' }])}
            className="inline-flex min-h-9 items-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-brand-soft"
          >
            {t.day.addEvent}
          </button>

          {/* ⚠️ רשימת החללים נערכת כאן, כי זה המקום שבו מגלים שחלל חסר. */}
          {newSpace === null ? (
            <button
              type="button"
              onClick={() => setNewSpace('')}
              className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              {t.day.addSpace}
            </button>
          ) : (
            <span className="flex items-center gap-2">
              <input
                dir="auto"
                value={newSpace}
                maxLength={40}
                placeholder={t.day.spaceName}
                onChange={(event) => setNewSpace(event.target.value)}
                className={field}
              />
              <button
                type="button"
                disabled={savingSpace || !newSpace.trim()}
                onClick={addSpace}
                className="inline-flex min-h-9 items-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-brand-soft disabled:opacity-50"
              >
                {savingSpace ? t.day.spaceSaving : t.day.noteSave}
              </button>
              <button
                type="button"
                onClick={() => setNewSpace(null)}
                className="px-2 text-sm text-ink-soft hover:underline"
              >
                {t.day.closeEditor}
              </button>
            </span>
          )}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-sm text-ink-soft">{t.day.noteLabel}</span>
        {/* ⚠️ dir="auto" ו-maxLength: הערה קצרה, ולא מסמך. */}
        <input
          dir="auto"
          value={note}
          maxLength={120}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.day.notePlaceholder}
          className={`mt-1.5 w-full ${field}`}
        />
      </label>

      <p className="mt-2 text-xs text-ink-faint">{t.day.namedDayHint}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-ink disabled:opacity-50"
        >
          {busy ? t.day.noteSaving : t.day.noteSave}
        </button>
        {note && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setNote('')}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-ink-soft underline-offset-4 hover:underline"
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
