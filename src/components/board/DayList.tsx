// src/components/board/DayList.tsx
//
// תצוגת הלוח ברוחב טלפון.
//
// ⚠️ זו אינה "התאמה שבאה אחר כך". רוב השימוש הוא בטלפון: חבר אופן ספייס אינו
// יושב מול מחשב כדי להשתבץ לשמירה. DOCS/PLANING/03-the-design-standard.md
//
// ולמה לא פשוט לגלול את הטבלה לצדדים: חמש עמודות ברוחב 390 דורשות גלילה
// אופקית, וגלילה אופקית בלוח שמיועד לסריקה מהירה היא מה שגורם לאנשים לוותר.
// רשימה אנכית של ימים היא אותו מידע בצורה שנקראת בלי לגלול לצדדים.

import { useState } from 'react';
import type { ActivityDay, Branch, Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import { WEEKDAY_NAMES, dayNumber, isPast, isToday, shortDateLabel, weekdayOf } from '../../utils/dates';
import { ShiftCell, shiftViewState } from './ShiftCell';
import { StatusPill } from '../common/StatusPill';

interface Props {
  branch: Branch;
  dates: string[];
  shiftsByDate: Map<string, Shift[]>;
  activityByDate: Map<string, ActivityDay>;
  memberId: string | null;
  canAct: boolean;
  onClaim: (shift: Shift) => Promise<void>;
  onRelease: (shift: Shift) => Promise<void>;
  onRequestHandover: (shift: Shift) => Promise<void>;
  onCancelHandover: (shift: Shift) => Promise<void>;
}

export function DayList({
  branch,
  dates,
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

  async function run(shift: Shift, fn: (shift: Shift) => Promise<void>) {
    setBusyId(shift.id);
    try {
      await fn(shift);
    } finally {
      setBusyId(null);
    }
  }

  const templates = branch.shiftTemplates.filter((template) => template.isActive);

  return (
    <ol className="flex flex-col gap-2">
      {dates.map((dateKey) => {
        const day = activityByDate.get(dateKey);
        const hasActivity = (day?.events?.length ?? 0) > 0;
        const shifts = shiftsByDate.get(dateKey) ?? [];
        const past = isPast(dateKey);
        const today = isToday(dateKey);

        return (
          <li
            key={dateKey}
            className={`rounded-lg border bg-surface p-2.5 ${
              today ? 'border-brand ring-1 ring-brand' : 'border-line'
            } ${past ? 'opacity-70' : ''}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="num text-lg font-semibold text-ink">{dayNumber(dateKey)}</span>
              <span className="text-sm font-medium text-ink-soft">
                {WEEKDAY_NAMES[weekdayOf(dateKey)]}
              </span>
              {today && <StatusPill tone="activity">{t.board.today}</StatusPill>}
              {hasActivity && <StatusPill tone="activity">{t.day.activity}</StatusPill>}
              {day?.memberAccess === 'closed' && (
                <StatusPill tone="closed">{t.day.closed}</StatusPill>
              )}
              {day?.publicAccess === 'closed' && day?.memberAccess === 'open' && (
                <StatusPill tone="membersOnly">{t.day.membersOnly}</StatusPill>
              )}
              {day?.publicAccess === 'closesEarly' && day.closesAt && (
                <StatusPill tone="closed">{t.day.closesEarly(day.closesAt)}</StatusPill>
              )}
              <span className="sr-only">{shortDateLabel(dateKey)}</span>
            </div>

            {hasActivity && (
              <ul className="mt-1.5 space-y-0.5">
                {day?.events.map((event, index) => (
                  <li key={index} className="text-sm leading-tight text-activity">
                    {event.title}
                    {event.startTime && (
                      <span className="num ms-1.5 text-xs text-ink-faint">
                        {event.startTime}
                        {event.endTime ? `-${event.endTime}` : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              {templates.map((template) => {
                if (!template.weekdays.includes(weekdayOf(dateKey))) return null;
                const shift = shifts.find((item) => item.templateId === template.id);
                if (!shift) return null;
                return (
                  <ShiftCell
                    key={shift.id}
                    shift={shift}
                    state={shiftViewState(shift, memberId, past)}
                    canAct={canAct}
                    busy={busyId === shift.id}
                    onClaim={() => void run(shift, onClaim)}
                    onRelease={() => void run(shift, onRelease)}
                    onRequestHandover={() => void run(shift, onRequestHandover)}
                    onCancelHandover={() => void run(shift, onCancelHandover)}
                  />
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
