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
import { DayNote, DayStatus } from './DayStatus';
import { dayAccessOf } from '../../utils/hebrew';

interface Props {
  branch: Branch;
  monthKey: string;
  /** שם החג לכל תאריך. ⚠️ מידע ולא מדיניות. */
  namedDays: Map<string, string>;
  /** ⚠️ למנהלת בלבד. מספר היום הופך לכפתור שפותח את עורך היום. */
  onPickDay?: (dateKey: string) => void;
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
  namedDays,
  onPickDay,
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

  /*
    ⚠️ שבעה ימים ולא חמישה.
    קודם הלוח צייר רק ימים שיש להם תבנית משמרת, ולכן שישי ושבת לא הופיעו בו
    כלל. הם כן קיימים בסלון, והם סגורים למי שאינו חבר אופן ספייס.
  */
  const WEEK = useMemo(() => [0, 1, 2, 3, 4, 5, 6], []);

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
    () => weeksOfMonth(monthKey, WEEK),
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
    return <p className="p-4 text-sm text-ink-soft">{t.board.noTemplates}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1.5" aria-label={t.a11y.monthTable}>
        <caption className="sr-only">{t.a11y.monthTable}</caption>
        <thead>
          <tr>
            {WEEK.map((weekday) => (
              <th
                key={weekday}
                scope="col"
                /* ⚠️ טקסט שקט ולא בלוק צבעוני. שבע רצועות צבע ברוחב העמודה
                   צועקות, ושם היום אינו הדבר שצריך לבלוט בלוח. */
                className="sticky top-0 z-10 bg-surface px-2 pb-2 text-sm font-medium text-ink-soft"
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
                // ⚠️ סדר עדיפות אחד: מה שהמנהלת כתבה, אחר כך סוף שבוע, אחר כך פתוח.
                const access = dayAccessOf(dateKey, day, namedDays.get(dateKey));
                const shut = access.memberAccess === 'closed';
                const shifts = shiftsByDate.get(dateKey) ?? [];
                const past = isPast(dateKey);
                const today = isToday(dateKey);

                return (
                  <td key={dayIndex} className="min-w-36 align-top">
                    {/*
                      ⚠️ יום בלי משמרות אינו כרטיס. הוא מספר על הרקע.
                      גבול סביב כל תא בחודש שלם הוא 35 מסגרות על מסך אחד, ואז
                      שום דבר אינו בולט. היום שמשובץ בו משהו הוא זה שנושא משטח.
                    */}
                    <div
                      className={`flex h-full flex-col gap-1.5 rounded-lg p-1.5 ${
                        today
                          ? 'bg-cell ring-2 ring-brand'
                          : shut
                            ? 'bg-closed'
                            : access.publicAccess === 'closed'
                              ? 'bg-members-only'
                              : shifts.length > 0
                                ? 'bg-cell'
                                : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 px-1 pt-0.5">
                        {/*
                          ⚠️ היום נושא עיגול מלא ולא תגית לצידו. הגרסה הקודמת
                          סימנה אותו בטבעת דקה ובתגית קטנה, ובעל המוצר דיווח
                          שהוא בדגש חלש עד בלתי נראה. המספר עצמו הוא הסימן.
                        */}
                        {(() => {
                          const look = `num font-semibold ${
                            today
                              ? 'grid size-7 place-items-center rounded-full bg-brand text-sm text-brand-ink'
                              : `text-base ${past ? 'text-ink-faint' : 'text-ink'}`
                          }`;
                          return onPickDay ? (
                            <button
                              type="button"
                              onClick={() => onPickDay(dateKey)}
                              aria-current={today ? 'date' : undefined}
                              aria-label={`${t.day.editDay} ${shortDateLabel(dateKey)}`}
                              className={`${look} underline-offset-4 hover:underline`}
                            >
                              {dayNumber(dateKey)}
                            </button>
                          ) : (
                            <span className={look} aria-current={today ? 'date' : undefined}>
                              {dayNumber(dateKey)}
                            </span>
                          );
                        })()}

                        {today && (
                          <span className="text-xs font-medium text-brand">{t.board.today}</span>
                        )}

                        {hasActivity && (
                          <StatusPill tone="activity">{t.day.activity}</StatusPill>
                        )}

                        <DayStatus access={access} />
                      </div>

                      <DayNote note={access.note} />

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

                      {!shut && templates.map((template) => {
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
