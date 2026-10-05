// src/components/board/MonthBoard.tsx
//
// לוח החודש.
//
// ⚠️ טבלה סמנטית, ולא רשת div. קורא מסך צריך לשמוע "שלישי, 8 באוקטובר, משמרת
// בוקר, פתוחה". DOCS/PLANING/03-the-design-standard.md
//
// ⚠️ ויום פעילות נגזר ואינו שדה: יום הוא יום פעילות אם ורק אם יש לו אירועים.
// זה מה שמונע את 16 הפערים שנמדדו בגיליון. DOCS/PLANING/01

import { useMemo, useState } from 'react';
import type { ActivityDay, Branch, Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import {
  WEEKDAY_NAMES,
  dayNumber,
  isPast,
  isToday,
  shortDateLabel,
  weeksOfMonth,
} from '../../utils/dates';
import { ShiftCell, shiftViewState } from './ShiftCell';
import { StatusPill } from '../common/StatusPill';

interface Props {
  branch: Branch;
  monthKey: string;
  shiftsByDate: Map<string, Shift[]>;
  activityByDate: Map<string, ActivityDay>;
  memberId: string | null;
  canAct: boolean;
  onClaim: (shift: Shift) => Promise<void>;
  onRelease: (shift: Shift) => Promise<void>;
  onRequestHandover: (shift: Shift) => Promise<void>;
  onCancelHandover: (shift: Shift) => Promise<void>;
}

export function MonthBoard({
  branch,
  monthKey,
  shiftsByDate,
  activityByDate,
  memberId,
  canAct,
  onClaim,
  onRelease,
  onRequestHandover,
  onCancelHandover,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  // ימי השבוע שיש להם תבנית פעילה. בחיפה זה אינו ראשון עד חמישי.
  const activeWeekdays = useMemo(() => {
    const days = new Set<number>();
    for (const template of branch.shiftTemplates) {
      if (!template.isActive) continue;
      for (const day of template.weekdays) days.add(day);
    }
    return [...days].sort((a, b) => a - b);
  }, [branch.shiftTemplates]);

  const templates = useMemo(
    () => branch.shiftTemplates.filter((template) => template.isActive),
    [branch.shiftTemplates],
  );

  const weeks = useMemo(
    () => weeksOfMonth(monthKey, activeWeekdays),
    [monthKey, activeWeekdays],
  );

  async function run(shift: Shift, fn: (shift: Shift) => Promise<void>) {
    setBusyId(shift.id);
    try {
      await fn(shift);
    } finally {
      setBusyId(null);
    }
  }

  if (weeks.length === 0 || activeWeekdays.length === 0) {
    return <p className="p-6 text-ink-soft">{t.board.empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1" aria-label={t.a11y.monthTable}>
        <caption className="sr-only">{t.a11y.monthTable}</caption>
        <thead>
          <tr>
            {activeWeekdays.map((weekday) => (
              <th
                key={weekday}
                scope="col"
                className="sticky top-0 z-10 rounded-md bg-brand px-2 py-2 text-sm font-semibold text-brand-ink"
              >
                {WEEKDAY_NAMES[weekday]}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex} className="align-top">
              {week.map((dateKey, dayIndex) => {
                if (!dateKey) {
                  return <td key={dayIndex} className="min-w-36" aria-hidden="true" />;
                }

                const day = activityByDate.get(dateKey);
                // ⚠️ נגזר. אין שדה "יש פעילות".
                const hasActivity = (day?.events?.length ?? 0) > 0;
                const shifts = shiftsByDate.get(dateKey) ?? [];
                const past = isPast(dateKey);
                const today = isToday(dateKey);

                return (
                  <td key={dayIndex} className="min-w-36 align-top">
                    <div
                      className={`flex h-full flex-col gap-1.5 rounded-lg border bg-surface p-1.5 ${
                        today ? 'border-brand ring-1 ring-brand' : 'border-line'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 px-1 pt-0.5">
                        <span
                          className={`num text-base font-semibold ${
                            past ? 'text-ink-faint' : 'text-ink'
                          }`}
                        >
                          {dayNumber(dateKey)}
                        </span>

                        {today && <StatusPill tone="activity">{t.board.today}</StatusPill>}

                        {hasActivity && (
                          <StatusPill tone="activity">{t.day.activity}</StatusPill>
                        )}

                        {day?.memberAccess === 'closed' && (
                          <StatusPill tone="closed">{t.day.closed}</StatusPill>
                        )}

                        {day?.publicAccess === 'closed' && day?.memberAccess === 'open' && (
                          <StatusPill tone="membersOnly">{t.day.membersOnly}</StatusPill>
                        )}

                        {day?.publicAccess === 'closesEarly' && day.closesAt && (
                          <StatusPill tone="closed">
                            {t.day.closesEarly(day.closesAt)}
                          </StatusPill>
                        )}
                      </div>

                      {hasActivity && (
                        <ul className="space-y-0.5 px-1">
                          {day?.events.map((event, index) => (
                            <li key={index} className="text-xs leading-tight text-activity">
                              {event.title}
                              {event.startTime && (
                                <span className="num ms-1 text-ink-faint">
                                  {event.startTime}
                                  {event.endTime ? `-${event.endTime}` : ''}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      {templates.map((template) => {
                        if (!template.weekdays.includes(new Date(dateKey).getDay())) return null;
                        const shift = shifts.find((item) => item.templateId === template.id);
                        if (!shift) return null;
                        const state = shiftViewState(shift, memberId, past);
                        return (
                          <ShiftCell
                            key={shift.id}
                            shift={shift}
                            state={state}
                            canAct={canAct}
                            busy={busyId === shift.id}
                            onClaim={() => void run(shift, onClaim)}
                            onRelease={() => void run(shift, onRelease)}
                            onRequestHandover={() => void run(shift, onRequestHandover)}
                            onCancelHandover={() => void run(shift, onCancelHandover)}
                          />
                        );
                      })}

                      <span className="sr-only">{shortDateLabel(dateKey)}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
