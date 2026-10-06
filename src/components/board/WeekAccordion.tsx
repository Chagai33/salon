// src/components/board/WeekAccordion.tsx
//
// הלוח בטלפון: אקורדיון שבועי.
//
// ⚠️ זו אינה "התאמה שבאה אחר כך". רוב השימוש הוא בטלפון: חבר אופן ספייס אינו
// יושב מול מחשב כדי להשתבץ לשמירה. DOCS/PLANING/03-the-design-standard.md
//
// ⚠️⚠️ ובהכרעת בעל המוצר, 06/10: "רשימה אחת אבל אולי תצוגה שבועית באקורדיון
// במקום רשימה אחת ארוכה."
// נמדד: לאוקטובר 2026 יש 31 ימים, והרשימה הקודמת ציירה את כולם. כאן נפתח
// השבוע שהיום נמצא בו, כלומר שבעה ימים במקום 31. DOCS/PLANING/26
//
// ⚠️ וכותרת המקטע נקראת גם סגורה: טווח התאריכים, כמה פתוחות, ומה ששלי.
// בלי זה האקורדיון רק מסתיר מידע במקום לסדר אותו.
//
// ⚠️ ומותר שכמה מקטעים יהיו פתוחים יחד. אקורדיון שסוגר את מה שפתחת קודם הוא
// בדיוק מה שמכריח לפתוח ולסגור בלי סוף.
//
// ⚠️⚠️ והמונים ב-useMemo ברכיב ולא בבורר. בורר שבונה אובייקט לכל מקטע הוא
// בדיוק הלולאה של DOCS/PLANING/16-the-selector-that-looped.md

import { useMemo, useState } from 'react';
import type { ActivityDay, Branch, Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import {
  WEEKDAY_NAMES,
  dayNumber,
  isPast,
  isToday,
  shortDateLabel,
  weekdayOf,
  weeksOfMonth,
} from '../../utils/dates';
import { ShiftCell, shiftViewState } from './ShiftCell';
import { StatusPill } from '../common/StatusPill';
import { DayName, DayNote, DayStatus } from './DayStatus';
import { DayEvents, eventsWorthShowing } from './DayEvents';
import { dayAccessOf, isWeekend } from '../../utils/hebrew';

const WEEK = [0, 1, 2, 3, 4, 5, 6];

type Filter = 'all' | 'mine' | 'open';

interface Props {
  branch: Branch;
  monthKey: string;
  /** שם החג לכל תאריך. ⚠️ מידע ולא מדיניות. */
  namedDays: Map<string, string>;
  shiftsByDate: Map<string, Shift[]>;
  activityByDate: Map<string, ActivityDay>;
  memberId: string | null;
  canAct: boolean;
  onPickDay: (dateKey: string) => void;
  onClaim: (shift: Shift) => Promise<void>;
  onRelease: (shift: Shift) => Promise<void>;
  onRequestHandover: (shift: Shift) => Promise<void>;
  onCancelHandover: (shift: Shift) => Promise<void>;
}

interface WeekSummary {
  index: number;
  dates: string[];
  openCount: number;
  hasMine: boolean;
  /** ⚠️ יש בשבוע משמרת או אירוע. שבוע ריק לגמרי אינו מצויר כלל. */
  hasAnything: boolean;
  /** כמה ימים עונים לסינון הנוכחי. ⚠️ ולא כמה משמרות. */
  matching: string[];
}

export function WeekAccordion({
  branch,
  monthKey,
  namedDays,
  shiftsByDate,
  activityByDate,
  memberId,
  canAct,
  onPickDay,
  onClaim,
  onRelease,
  onRequestHandover,
  onCancelHandover,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  /** ⚠️ null פירושו "עוד לא נגעתי", ואז ברירת המחדל קובעת. */
  const [opened, setOpened] = useState<Set<number> | null>(null);

  const templates = useMemo(
    () => branch.shiftTemplates.filter((template) => template.isActive),
    [branch.shiftTemplates],
  );

  const weeks = useMemo<WeekSummary[]>(() => {
    return weeksOfMonth(monthKey, WEEK).map((week, index) => {
      const dates = week.filter((date): date is string => date !== null);
      let openCount = 0;
      let hasMine = false;
      let hasAnything = false;
      const matching: string[] = [];

      for (const dateKey of dates) {
        const day = activityByDate.get(dateKey);
        const shifts = shiftsByDate.get(dateKey) ?? [];
        const past = isPast(dateKey);
        /*
          ⚠️ יום שהמנהלת סגרה אינו מציג משמרת, ולכן אינו נספר.
          בלשון בעל המוצר, 06/10. DOCS/PLANING/26
        */
        const shut = day?.publicAccess === 'closed' || day?.memberAccess === 'closed';

        if (shifts.length > 0 || (day?.events?.length ?? 0) > 0) hasAnything = true;

        let dayOpen = 0;
        let dayMine = false;
        for (const shift of shifts) {
          if (past || shut) continue;
          if (!shift.assigneeMemberId) dayOpen += 1;
          if (memberId && shift.assigneeMemberId === memberId) dayMine = true;
        }
        openCount += dayOpen;
        if (dayMine) hasMine = true;
        if (filter === 'all' || (filter === 'mine' && dayMine) || (filter === 'open' && dayOpen > 0)) {
          matching.push(dateKey);
        }
      }

      return { index, dates, openCount, hasMine, hasAnything, matching };
    });
  }, [monthKey, shiftsByDate, activityByDate, memberId, filter]);

  /** ⚠️ השבוע שהיום נמצא בו, והוא בלבד. בחודש אחר, הראשון. */
  const defaultOpen = useMemo(() => {
    const found = weeks.findIndex((week) => week.dates.some((date) => isToday(date)));
    return found >= 0 ? found : 0;
  }, [weeks]);

  function isOpen(week: WeekSummary): boolean {
    // ⚠️ בסינון פעיל האקורדיון נפתח לבד על כל מקטע שיש בו התאמה.
    if (filter !== 'all') return week.matching.length > 0;
    if (opened) return opened.has(week.index);
    return week.index === defaultOpen;
  }

  function toggle(week: WeekSummary) {
    const next = new Set(opened ?? [defaultOpen]);
    if (next.has(week.index)) next.delete(week.index);
    else next.add(week.index);
    setOpened(next);
  }

  async function run(shift: Shift, fn: (shift: Shift) => Promise<void>) {
    setBusyId(shift.id);
    try {
      await fn(shift);
    } finally {
      setBusyId(null);
    }
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t.board.filterAll },
    { key: 'mine', label: t.board.filterMine },
    { key: 'open', label: t.board.filterOpen },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* ⚠️ סינון, ולא שלוש תצוגות. אותה רשימה, פחות שורות. */}
      <div role="group" aria-label={t.board.title} className="flex gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`min-h-9 rounded-full px-3.5 text-sm font-medium transition-colors ${
              filter === item.key
                ? 'bg-brand text-brand-ink'
                : 'bg-surface-sunken text-ink-soft hover:bg-brand-soft'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-1.5">
        {weeks.map((week) => {
          /*
            ⚠️ שבוע בלי משמרת ובלי אירוע אינו מצויר.
            בלשון בעל המוצר, 06/10: "אם אין משמרות לחלק הראשון אז אין סיבה
            להציג". DOCS/PLANING/26
          */
          if (!week.hasAnything) return null;

          const open = isOpen(week);
          const first = week.dates[0];
          const last = week.dates[week.dates.length - 1];
          const empty = filter !== 'all' && week.matching.length === 0;

          return (
            <li key={week.index} className="overflow-hidden rounded-card border border-line bg-surface">
              <button
                type="button"
                onClick={() => toggle(week)}
                aria-expanded={open}
                disabled={empty}
                className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-start hover:bg-brand-soft disabled:opacity-60 disabled:hover:bg-transparent"
              >
                <span className="flex-1 text-sm font-semibold text-ink">
                  {t.board.weekRange(shortDateLabel(first), shortDateLabel(last))}
                </span>

                {/* ⚠️ מה שדורש פעולה נאמר בכותרת, כדי שלא יידרש לפתוח כדי לדעת. */}
                {empty ? (
                  <span className="text-xs text-ink-faint">{t.board.weekNoMatch}</span>
                ) : (
                  <>
                    {week.hasMine && <StatusPill tone="mine">{t.board.weekMine}</StatusPill>}
                    {/* ⚠️ ואפס אינו נאמר. "אין משמרות" על שבוע שעבר הוא רעש. */}
                    {week.openCount > 0 && (
                      <span className="text-xs text-ink-soft">{t.board.weekOpen(week.openCount)}</span>
                    )}
                  </>
                )}

                {/* ⚠️ המשולש אינו חץ כיווני ולכן אינו מתהפך ב-RTL. */}
                <span
                  aria-hidden="true"
                  className={`text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
                >
                  ▾
                </span>
              </button>

              {open && (
                <ol className="flex flex-col gap-1.5 border-t border-line p-2">
                  {(filter === 'all' ? week.dates : week.matching).map((dateKey) => {
                    const day = activityByDate.get(dateKey);
                    const name = namedDays.get(dateKey);
                    const events = eventsWorthShowing(day?.events, name);
                    const shifts = shiftsByDate.get(dateKey) ?? [];
                    const past = isPast(dateKey);
                    const today = isToday(dateKey);
                    const access = dayAccessOf(dateKey, day, name);
                    const noShifts =
                      access.publicAccess === 'closed' || access.memberAccess === 'closed';
                    const weekend = isWeekend(dateKey);

                    /* ⚠️ לפי השעון ולא לפי סדר התבניות: `groupShiftsByDate`
                       כבר ממיין, והבוקר בא לפני הערב. DOCS/PLANING/26 */
                    const visibleShifts = noShifts
                      ? []
                      : shifts.filter((shift) =>
                          templates.some((template) => template.id === shift.templateId),
                        );

                    /*
                      ⚠️ יום בלי משמרת, בלי פעילות ובלי הערה הוא שורה שקטה.
                      בטלפון, שלושים כרטיסים ריקים הם שלושים מסכים של גלילה בלי
                      מידע. DOCS/PLANING/26
                    */
                    const quiet =
                      !today && visibleShifts.length === 0 && events.length === 0 && !access.note;

                    if (quiet) {
                      return (
                        <li key={dateKey}>
                          <button
                            type="button"
                            onClick={() => onPickDay(dateKey)}
                            className="flex min-h-8 w-full items-center gap-2 rounded px-1 text-start text-sm text-ink-faint"
                          >
                            <span className="num w-6 font-medium">{dayNumber(dateKey)}</span>
                            <span>{WEEKDAY_NAMES[weekdayOf(dateKey)]}</span>
                            <DayName name={access.name} />
                            <DayStatus access={access} weekend={weekend} />
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={dateKey}
                        className={`rounded-lg p-2.5 ${
                          today
                            ? 'bg-cell ring-2 ring-brand'
                            : access.memberAccess === 'closed'
                              ? 'bg-closed'
                              : weekend || access.publicAccess === 'closed'
                                ? 'bg-surface-sunken'
                                : visibleShifts.length > 0
                                  ? 'bg-cell'
                                  : ''
                        } ${past ? 'opacity-70' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => onPickDay(dateKey)}
                          className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-start"
                        >
                          <span className="num text-lg font-semibold text-ink">
                            {dayNumber(dateKey)}
                          </span>
                          <span className="text-sm font-medium text-ink-soft">
                            {WEEKDAY_NAMES[weekdayOf(dateKey)]}
                          </span>
                          {/* ⚠️ "היום" אינו תגית ירוקה: ירוק הוא "שלי",
                              ושתי משמעויות לאותו צבע הן בדיוק מה שהיה שבור. */}
                          {today && (
                            <span className="text-sm font-medium text-brand">{t.board.today}</span>
                          )}
                          <DayName name={access.name} />
                          <DayStatus access={access} weekend={weekend} />
                          <span className="sr-only">{shortDateLabel(dateKey)}</span>
                        </button>

                        <DayNote note={access.note} />

                        {events.length > 0 && (
                          <div className="mt-1.5">
                            <DayEvents events={events} size="sm" />
                          </div>
                        )}

                        {/* ⚠️ כרטיס אחד בשורה. ברוחב 390 שני כרטיסים הם 175
                            פיקסלים כל אחד, ובתוכם שעה, תגית, שם וכפתור. */}
                        {visibleShifts.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {visibleShifts.map((shift) => (
                              <ShiftCell
                                key={shift.id}
                                wide
                                shift={shift}
                                state={shiftViewState(shift, memberId, past)}
                                canAct={canAct}
                                busy={busyId === shift.id}
                                onClaim={() => void run(shift, onClaim)}
                                onRelease={() => void run(shift, onRelease)}
                                onRequestHandover={() => void run(shift, onRequestHandover)}
                                onCancelHandover={() => void run(shift, onCancelHandover)}
                              />
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
