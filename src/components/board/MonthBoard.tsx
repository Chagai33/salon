// src/components/board/MonthBoard.tsx
//
// לוח החודש. ⚠️ תצוגת דסקטופ, בהכרעת בעל המוצר 06/10: בטלפון יש אקורדיון
// שבועי, ושבע עמודות ברוחב 390 הן 55 פיקסלים כל אחת, שלא נכנס בהן שם של אדם.
//
// ⚠️ טבלה סמנטית, ולא רשת div. קורא מסך צריך לשמוע "שלישי, 8 באוקטובר, משמרת
// בוקר, פתוחה". DOCS/PLANING/03-the-design-standard.md
//
// ⚠️ ויום פעילות נגזר ואינו שדה: יום הוא יום פעילות אם ורק אם יש לו אירועים.
// זה מה שמונע את 16 הפערים שנמדדו בגיליון. DOCS/PLANING/01
//
// ⚠️⚠️ וגובה התא קבוע, --cell-h, והתוכן נחתך.
// קודם לא היה לתא גובה בכלל, ולכן יום אחד עם פעילות והערה מתח את כל שורת
// השבוע. מה שנחתך נמצא בגיליון היום, שנפתח בלחיצה. DOCS/PLANING/26
//
// ⚠️⚠️ והצבע שייך למשמרת בלבד.
// יום, יום בשבוע, שם חג ופעילות הם טיפוגרפיה וריווח. נמדד שתא אחד יכול היה
// לשאת חמש תגיות, ואז שום דבר אינו בולט. DOCS/PLANING/26

import { useMemo } from 'react';
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
import { shiftViewState } from './ShiftCell';
import { ShiftChip } from './ShiftChip';
import { DayName, DayStatus } from './DayStatus';
import { DayEvents, eventsWorthShowing } from './DayEvents';
import { dayAccessOf, isWeekend } from '../../utils/hebrew';

const WEEK = [0, 1, 2, 3, 4, 5, 6];

interface Props {
  branch: Branch;
  monthKey: string;
  /** שם החג לכל תאריך. ⚠️ מידע ולא מדיניות. */
  namedDays: Map<string, string>;
  /** ⚠️ לכל המשתמשים ולא למנהלת בלבד: הפעולות עברו לגיליון היום. */
  onPickDay: (dateKey: string) => void;
  shiftsByDate: Map<string, Shift[]>;
  activityByDate: Map<string, ActivityDay>;
  memberId: string | null;
  /**
   * ⚠️ למנהלת היום נפתח תמיד, כי זה המקום שבו היא כותבת אותו.
   * ⚠️⚠️ ולחבר, יום ריק אינו נפתח: בלשון בעל המוצר 06/10 "חלון שאין בו כלום
   * אין טעם שייפתח, למשל שישי ושבת". DOCS/PLANING/26
   */
  canEdit: boolean;
}

export function MonthBoard({
  branch,
  monthKey,
  namedDays,
  onPickDay,
  shiftsByDate,
  activityByDate,
  memberId,
  canEdit,
}: Props) {
  const templates = useMemo(
    () => branch.shiftTemplates.filter((template) => template.isActive),
    [branch.shiftTemplates],
  );

  const weeks = useMemo(() => weeksOfMonth(monthKey, WEEK), [monthKey]);

  if (weeks.length === 0 || templates.length === 0) {
    return <p className="p-4 text-sm text-ink-soft">{t.board.noTemplates}</p>;
  }

  return (
    <table
      className="w-full table-fixed border-separate border-spacing-1"
      aria-label={t.a11y.monthTable}
    >
      <caption className="sr-only">{t.a11y.monthTable}</caption>
      <thead>
        <tr>
          {WEEK.map((weekday) => (
            <th
              key={weekday}
              scope="col"
              /* ⚠️ טקסט שקט ולא בלוק צבעוני. שבע רצועות צבע ברוחב העמודה
                 צועקות, ושם היום אינו הדבר שצריך לבלוט בלוח. */
              /* ⚠️ נעוץ מתחת לכותרת, בבקשת בעל המוצר 06/10: "שורת ראשון עד
                 שבת תישאר נעולה גם בגלילה למטה". 56 פיקסלים הם גובה הכותרת. */
              className={`sticky top-14 z-10 bg-surface px-2 pb-2 pt-1 text-sm font-medium ${
                weekday >= 5 ? 'text-ink-faint' : 'text-ink-soft'
              }`}
            >
              {WEEKDAY_NAMES[weekday]}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {weeks.map((week, weekIndex) => (
          <tr key={weekIndex}>
            {week.map((dateKey, dayIndex) => {
              if (!dateKey) {
                return <td key={dayIndex} aria-hidden="true" />;
              }

              const day = activityByDate.get(dateKey);
              const name = namedDays.get(dateKey);
              // ⚠️ נגזר. אין שדה "יש פעילות".
              const events = eventsWorthShowing(day?.events, name);
              // ⚠️ סדר עדיפות אחד: מה שהמנהלת כתבה, אחר כך סוף שבוע, אחר כך פתוח.
              const access = dayAccessOf(dateKey, day, name);
              /*
                ⚠️⚠️ משמרת קיימת רק כשהסלון פתוח לכולם, בתיקון בעל המוצר 06/10.
                המשמרת היא שמירה על סלון שפתוח לציבור. בשישי ושבת הסלון פתוח
                לחברי האופן ספייס בלבד, ולכן אין בהם מה לשמור ואין משמרת.
                ⚠️ ו-closesEarly כן נושא משמרת: הסלון פתוח לכולם, ונסגר מוקדם.
              */
              const noShifts =
                access.publicAccess === 'closed' || access.memberAccess === 'closed';
              const shifts = shiftsByDate.get(dateKey) ?? [];
              const past = isPast(dateKey);
              const today = isToday(dateKey);
              /*
                ⚠️ סוף שבוע הוא שקע של התא ולא תגית בתוכו.
                הוא קבוע, והוא נאמר פעם אחת במקרא. DOCS/PLANING/26
              */
              const weekend = isWeekend(dateKey);

              /*
                ⚠️ יום ריק אינו נפתח לחבר.
                ריק פירושו: בלי משמרת שמוצגת, בלי אירוע, בלי הערה, ובלי מצב
                שהמנהלת כתבה. DOCS/PLANING/26
              */
              const visibleShifts = noShifts
                ? []
                : shifts.filter((shift) =>
                    templates.some((template) => template.id === shift.templateId),
                  );
              const empty =
                visibleShifts.length === 0 &&
                events.length === 0 &&
                !access.note &&
                access.from !== 'manager';
              const opens = canEdit || !empty;

              return (
                <td key={dayIndex} className="align-top">
                  {/*
                    ⚠️⚠️ כל המשבצת פותחת את היום, ולא המספר בלבד.
                    בעל המוצר, 06/10: "צריך ללחוץ ממש על הספרה כדי שהתפריט
                    ייפתח, זה מטעה". ⚠️ ו-div עם onClick ולא button, כי בתוכו
                    יש כבר כפתורי משמרת, וכפתור בתוך כפתור אינו חוקי.
                    ⚠️ ויש לו role ו-tabIndex, כדי שמקלדת תגיע אליו.
                  */}
                  <div
                    role={opens ? 'button' : undefined}
                    tabIndex={opens ? 0 : undefined}
                    aria-label={opens ? `${t.day.openDay} ${shortDateLabel(dateKey)}` : undefined}
                    onClick={opens ? () => onPickDay(dateKey) : undefined}
                    onKeyDown={
                      opens
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onPickDay(dateKey);
                            }
                          }
                        : undefined
                    }
                    className={`flex h-[var(--cell-h)] flex-col gap-1 overflow-hidden rounded-lg p-1.5 ${
                      opens ? 'cursor-pointer' : ''
                    } ${
                      today
                        ? 'bg-cell ring-2 ring-brand'
                        : access.memberAccess === 'closed'
                          ? 'bg-closed'
                          : /* ⚠️ שישי ושבת: שום סימן. בעל המוצר ראה את הפסים
                               ב-06/10 ואמר להוריד אותם, ואת המילים לפניהם.
                               העמודה פשוט שקטה. DOCS/PLANING/26 */
                            weekend
                            ? ''
                            : access.publicAccess === 'closed'
                              ? 'bg-surface-sunken'
                              : shifts.length > 0
                                ? 'bg-cell'
                                : ''
                    }`}
                  >
                    {/* שורה 1: היום. ⚠️ שורה אחת, וחיתוך. */}
                    <div className="flex h-5 shrink-0 items-center gap-1.5">
                      {/*
                        ⚠️ היום נושא עיגול מלא ולא תגית לצידו. הגרסה הקודמת
                        סימנה אותו בטבעת דקה ובתגית קטנה, ובעל המוצר דיווח
                        שהוא בדגש חלש עד בלתי נראה. המספר עצמו הוא הסימן.
                      */}
                      {/* ⚠️ המספר הוא סימן ולא כפתור: המשבצת כולה פותחת. */}
                      <span
                        aria-current={today ? 'date' : undefined}
                        className={`num shrink-0 font-semibold ${
                          today
                            ? 'grid size-6 place-items-center rounded-full bg-brand text-sm text-brand-ink'
                            : `text-base ${past || weekend ? 'text-ink-faint' : 'text-ink'}`
                        }`}
                      >
                        {dayNumber(dateKey)}
                      </span>

                      <DayName name={access.name} />
                      <DayStatus access={access} weekend={weekend} />

                      {/* ⚠️ נקודה ולא טקסט. ההערה המלאה בגיליון היום, והיא מה
                          ששבר את גובה השורה. */}
                      {/* ⚠️ ובשישי ושבת גם הנקודה אינה מופיעה: ההערה שם אומרת
                          את מה שהקו האלכסוני כבר אומר. */}
                      {access.note && !weekend && (
                        <span
                          aria-hidden="true"
                          title={access.note}
                          className="ms-auto size-1.5 shrink-0 rounded-full bg-ink-faint"
                        />
                      )}
                    </div>

                    {/* שורה 2: פעילות. ⚠️ שורה אחת, והיתר נספרות. */}
                    {events.length > 0 && (
                      <div className="shrink-0">
                        <DayEvents events={events} limit={1} />
                      </div>
                    )}

                    {/* שורה 3: המשמרות. ⚠️ וזה הדבר היחיד בתא שנושא צבע. */}
                    {!noShifts && (
                      <div className="flex min-h-0 flex-col gap-1">
                        {/* ⚠️ לפי השעון ולא לפי סדר התבניות. DOCS/PLANING/26 */}
                        {visibleShifts.map((shift) => (
                            <ShiftChip
                              key={shift.id}
                              shift={shift}
                              state={shiftViewState(shift, memberId, past)}
                            onOpen={() => onPickDay(dateKey)}
                          />
                        ))}
                      </div>
                    )}

                    <span className="sr-only">{shortDateLabel(dateKey)}</span>
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
