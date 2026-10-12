// src/components/admin/ReleasesReport.tsx
//
// מי שחרר משמרת. למנהלת בלבד.
// DOCS/PLANING/33-the-manager-screens-are-lists-and-the-question-is-about-people.md
//
// ⚠️⚠️ חודש, ארבעה מספרים, ושורה לכל אדם. בהכרעת בעל המוצר 12/10, סעיף 1:
// "אני רוצה לראות נתונים ולא רשימות ארוכות". השאלה היא על אדם בתוך חודש,
// והשחרורים עצמם נפתחים בלחיצה על השם.
//
// ⚠️ וחמש עמודות ולא שבע, כדי שהטבלה תיכנס בגיליון בלי גלילה לצדדים. בצילום
// של בעל המוצר העמודה השביעית לא נראתה מעולם.
//
// ⚠️ וההיגיון ב-src/utils/releases.ts, ולא כאן, כדי שייבדק בלי מסך.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { shutDatesOf, useStore } from '../../store/useStore';
import { activityDaysOfMonth, allShifts, loadEvents } from '../../services/salonService';
import { monthReport } from '../../utils/releases';
import type { PersonRow, ReleaseRow } from '../../utils/releases';
import type { ActivityDay, SalonEvent, Shift } from '../../types';
import { t } from '../../i18n/dictionary';
import { addMonths, monthLabel, shortDateLabel, toMonthKey } from '../../utils/dates';
import { displayName, managerLabels } from '../../utils/names';
import { toReadableError } from '../../utils/errors';
import { Button } from '../common/Button';
import { Stamp, TimeRange } from '../common/Stamp';

/** ⚠️ ימים כשיש ימים, שעות כשיש שעות, ושלילי הוא אחרי שהמשמרת התחילה. */
function noticeLabel(hours: number | null): string {
  if (hours === null) return t.releases.noticeUnknown;
  if (hours < 0) return t.releases.noticeLate;
  if (hours < 1) return t.releases.noticeNow;
  if (hours < 24) return t.releases.noticeHours(Math.floor(hours));
  return t.releases.noticeDays(Math.floor(hours / 24));
}

function afterLabel(row: ReleaseRow, nameOf: (id: string) => string): string {
  if (row.after === 'taken') {
    // ⚠️ אותו שם כמו בטבלה, ומייל כששניים נושאים אותו שם. רשומה 32.
    const name = row.afterMemberId ? nameOf(row.afterMemberId) : displayName(row.afterName ?? '');
    return t.releases.afterTaken(name);
  }
  if (row.after === 'open') return t.releases.afterOpen;
  return t.releases.afterUnknown;
}

function monthVerdict(person: PersonRow): string {
  if (person.month === 'otherShift') return t.releases.otherYes;
  if (person.month === 'none') return t.releases.otherNo;
  return t.releases.otherOpen;
}

/** מספר אחד. ⚠️ מילה לצד המספר, ולא צבע לבד. CLAUDE.md, עיצוב. */
function Tile({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: number;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-card bg-surface-sunken p-3">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className={`num text-2xl font-semibold ${alert && value > 0 ? 'text-danger' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-ink-faint">{hint}</div>
    </div>
  );
}

/** מספר בתא. ⚠️ אפס שקט, ומה שאינו אפס בולט, כי זה מה שהמנהלת מחפשת. */
function Count({ value, alert = false }: { value: number; alert?: boolean }) {
  const tone = value === 0 ? 'text-ink-faint' : alert ? 'font-medium text-danger' : 'text-ink';
  return <span className={`num ${tone}`}>{value}</span>;
}

/** השחרורים של אדם אחד, שורה לכל שחרור. ⚠️ זה מה שהיה הדוח כולו. */
function Details({ person, nameOf }: { person: PersonRow; nameOf: (id: string) => string }) {
  return (
    <ul className="flex flex-col gap-2 py-1">
      {person.rows.map((row) => (
        <li key={row.eventId} className="flex flex-col gap-0.5 text-sm">
          <span className="text-ink">
            {row.shiftDate ? shortDateLabel(row.shiftDate) : ''}
            {row.startTime && row.endTime && (
              <>
                {' '}
                <TimeRange from={row.startTime} to={row.endTime} />
              </>
            )}
          </span>
          <span className="text-xs text-ink-soft">
            {t.releases.released} <Stamp at={row.at} />
            {' · '}
            <span className={row.late ? 'text-danger' : ''}>{noticeLabel(row.noticeHours)}</span>
            {' · '}
            <bdi>{afterLabel(row, nameOf)}</bdi>
            {/* ⚠️ והסימן הזה הוא הכרעה: החבר לא החליט על זה. */}
            {row.byManager && ` · ${t.releases.byManager}`}
            {/* ⚠️ `assumed` אינו "הגיע", ולכן הוא אינו נאמר. רק מה שמנהלת סימנה. */}
            {row.attendance && row.attendance !== 'assumed' && ` · ${t.log.attendance[row.attendance]}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ReleasesReport({ branchId }: { branchId: string }) {
  const members = useStore((state) => state.members);
  const setError = useStore((state) => state.setError);

  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));
  const [events, setEvents] = useState<SalonEvent[] | null>(null);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [days, setDays] = useState<ActivityDay[]>([]);
  /** ⚠️ מי פתוח. אדם אחד בכל פעם, כדי שהטבלה לא תהפוך שוב לרשימה ארוכה. */
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    /*
      ⚠️ כל השורות ולא רק השחרורים: כדי לדעת אם אדם חזר למשמרת שהוא שחרר
      צריך לראות גם את הלקיחות. רשומה 32.
    */
    void Promise.all([loadEvents(branchId), allShifts(branchId)])
      .then(([rows, all]) => {
        if (cancelled) return;
        setEvents(rows);
        setShifts(all);
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(toReadableError(error, t.errors.loadMonth));
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, setError]);

  useEffect(() => {
    let cancelled = false;
    // ⚠️ ימים שהמנהלת סגרה לחברים אינם נספרים, בדיוק כמו בלוח.
    void activityDaysOfMonth(branchId, monthKey)
      .then((rows) => {
        if (!cancelled) setDays(rows);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, monthKey]);

  // ⚠️ ב-useMemo ולא בבורר, כמו כל גזירה שבונה מבנה חדש. CLAUDE.md
  const labels = useMemo(() => managerLabels(members), [members]);
  const shutDates = useMemo(() => shutDatesOf(days), [days]);
  const report = useMemo(
    () => (events && shifts ? monthReport(events, shifts, monthKey, shutDates) : null),
    [events, shifts, monthKey, shutDates],
  );

  if (!report) return <p className="text-sm text-ink-soft">{t.releases.loading}</p>;

  const nameOf = (id: string) => labels.get(id) ?? t.log.unknownMember;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{monthLabel(monthKey)}</h3>
        <div className="flex gap-2">
          <Button
            tone="secondary"
            size="sm"
            onClick={() => {
              setMonthKey((key) => addMonths(key, -1));
              setOpenId(null);
            }}
          >
            {t.releases.prevMonth}
          </Button>
          <Button
            tone="secondary"
            size="sm"
            onClick={() => {
              setMonthKey((key) => addMonths(key, 1));
              setOpenId(null);
            }}
          >
            {t.releases.nextMonth}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label={t.releases.tileAssigned}
          value={report.assigned}
          hint={t.releases.tileAssignedOf(report.shifts)}
        />
        <Tile
          label={t.releases.tileReleases}
          value={report.releases}
          hint={t.releases.tileReleasesOf(report.people)}
        />
        <Tile label={t.releases.tileLate} value={report.late} hint={t.releases.tileLateHint} alert />
        <Tile
          label={t.releases.tileUncovered}
          value={report.uncovered}
          hint={t.releases.tileUncoveredHint}
          alert
        />
      </div>

      {report.rows.length === 0 ? (
        <p className="text-sm text-ink-faint">{t.releases.empty}</p>
      ) : (
        /*
          ⚠️ טבלה ולא רשת כרטיסים, CLAUDE.md, עיצוב. ⚠️ ו-`table-fixed` עם
          רוחב לכל עמודה, כדי שהיא תיכנס בגיליון ולא תגלול לצדדים.
        */
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-soft">
              <th scope="col" className="w-[30%] py-2 pe-2 text-start font-medium">
                {t.releases.who}
              </th>
              <th scope="col" className="py-2 pe-2 text-start font-medium">
                {t.releases.colReleases}
              </th>
              <th scope="col" className="py-2 pe-2 text-start font-medium">
                {t.releases.colLate}
              </th>
              <th scope="col" className="py-2 pe-2 text-start font-medium">
                {t.releases.colUncovered}
              </th>
              <th scope="col" className="w-[24%] py-2 text-start font-medium">
                {t.releases.colOther}
              </th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((person) => {
              const name = nameOf(person.memberId);
              const open = openId === person.memberId;
              // ⚠️ Fragment עם מפתח ולא מערך: שתי שורות לאדם, השנייה רק כשהוא פתוח.
              return (
                <Fragment key={person.memberId}>
                <tr className="border-t border-line align-top">
                  <td className="py-2 pe-2">
                    {/* ⚠️ כפתור ולא טקסט שאפשר ללחוץ עליו: מקלדת וקורא מסך. */}
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={t.releases.showDetails(name)}
                      onClick={() => setOpenId(open ? null : person.memberId)}
                      className="text-start font-medium text-brand underline-offset-4 hover:underline"
                    >
                      <bdi className="break-words">{name}</bdi>
                    </button>
                  </td>
                  <td className="py-2 pe-2">
                    <Count value={person.releases} />
                    {person.byManager > 0 && (
                      <span className="block text-xs text-ink-faint">
                        {t.releases.byManagerCount(person.byManager)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pe-2">
                    <Count value={person.late} alert />
                  </td>
                  <td className="py-2 pe-2">
                    <Count value={person.uncovered} alert />
                  </td>
                  <td
                    className={`py-2 ${person.month === 'none' ? 'font-medium text-danger' : 'text-ink-soft'}`}
                  >
                    {monthVerdict(person)}
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={5} className="bg-surface-sunken px-3 pb-2">
                      <Details person={person} nameOf={nameOf} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
