// src/components/admin/ReleasesReport.tsx
//
// מי שחרר משמרת. למנהלת בלבד.
// DOCS/PLANING/33-the-manager-screens-are-lists-and-the-question-is-about-people.md
//
// ⚠️⚠️ חודש, ארבעה מספרים, ושורה לכל אדם. בהכרעת בעל המוצר 12/10, סעיף 1:
// "אני רוצה לראות נתונים ולא רשימות ארוכות". השחרורים עצמם נפתחים בלחיצה.
//
// ⚠️⚠️ ושתי תצוגות לאותו מידע, בהכרעה 1 א ברשומה 34: טבלה במסך רחב, ושורה
// מקופלת לכל אדם בטלפון. חמש עמודות ב-313 פיקסלים שברו כל כותרת לשלוש שורות,
// והמייל גלש מעמודת השם. ⚠️ וזה אותו כלל שהוכרע ללוח ב-06/10, BoardPage.tsx.
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
import { displayName, labelText, managerLabels } from '../../utils/names';
import type { ManagerLabel } from '../../utils/names';
import { toReadableError } from '../../utils/errors';
import { Button } from '../common/Button';
import { Stamp, TimeRange } from '../common/Stamp';

type LabelOf = (id: string) => ManagerLabel | undefined;

/** ⚠️ ימים כשיש ימים, שעות כשיש שעות, ושלילי הוא אחרי שהמשמרת התחילה. */
function noticeLabel(hours: number | null): string {
  if (hours === null) return t.releases.noticeUnknown;
  if (hours < 0) return t.releases.noticeLate;
  if (hours < 1) return t.releases.noticeNow;
  if (hours < 24) return t.releases.noticeHours(Math.floor(hours));
  return t.releases.noticeDays(Math.floor(hours / 24));
}

function afterLabel(row: ReleaseRow, labelOf: LabelOf): string {
  if (row.after === 'taken') {
    const label = row.afterMemberId ? labelOf(row.afterMemberId) : undefined;
    return t.releases.afterTaken(label ? labelText(label) : displayName(row.afterName ?? ''));
  }
  if (row.after === 'open') return t.releases.afterOpen;
  return t.releases.afterUnknown;
}

function monthVerdict(person: PersonRow): string {
  if (person.month === 'otherShift') return t.releases.otherYes;
  if (person.month === 'none') return t.releases.otherNo;
  return t.releases.otherOpen;
}

/**
 * מספר אחד.
 *
 * ⚠️ ארבעה בשורה בכל רוחב. שתיים על שתיים תפסו בטלפון כשני שלישים מהגיליון,
 * והטבלה התחילה בתחתית. ⚠️ ושורת ההסבר במסך רחב בלבד. רשומה 34.
 * ⚠️ ואפס שקט: "0" גדול נראה כמו מספר שחשוב.
 */
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
  const tone = value === 0 ? 'text-ink-faint' : alert ? 'text-danger' : 'text-ink';
  return (
    <div className="min-w-0 rounded-card bg-surface-sunken p-2 sm:p-3">
      <div className="text-xs leading-tight text-ink-soft">{label}</div>
      <div className={`num text-xl font-semibold sm:text-2xl ${tone}`}>{value}</div>
      <div className="hidden text-xs text-ink-faint sm:block">{hint}</div>
    </div>
  );
}

/** מספר בתא. ⚠️ אפס שקט, ומה שאינו אפס בולט. */
function Count({ value, alert = false }: { value: number; alert?: boolean }) {
  const tone = value === 0 ? 'text-ink-faint' : alert ? 'font-medium text-danger' : 'text-ink';
  return <span className={`num ${tone}`}>{value}</span>;
}

/**
 * השם, והמייל בשורה משלו.
 *
 * ⚠️ ולא "שם (מייל)" במחרוזת אחת: מייל הוא מילה אחת ארוכה, והוא גלש מעמודת
 * השם. ⚠️ והוא משמאל לימין, ונשבר בכל מקום, כי אין בו רווח. רשומה 34.
 */
function PersonName({
  label,
  open,
  onToggle,
}: {
  label: ManagerLabel | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const name = label?.name ?? t.log.unknownMember;
  return (
    <div className="min-w-0">
      {/* ⚠️ כפתור ולא טקסט שאפשר ללחוץ עליו: מקלדת וקורא מסך. */}
      <button
        type="button"
        aria-expanded={open}
        aria-label={t.releases.showDetails(name)}
        onClick={onToggle}
        className="text-start font-medium text-brand underline-offset-4 hover:underline"
      >
        <bdi>{name}</bdi>
      </button>
      {/* ⚠️ הבלוק נשאר מימין לשמאל, כדי שהמייל ייושר מתחת לשם, ורק המייל
          עצמו משמאל לימין. בלוק שכולו ltr יישר אותו לקצה השני. */}
      {label?.email && (
        <span className="block break-all text-xs text-ink-faint">
          <bdi dir="ltr">{label.email}</bdi>
        </span>
      )}
    </div>
  );
}

/** השחרורים של אדם אחד, שורה לכל שחרור. */
function Details({ person, labelOf }: { person: PersonRow; labelOf: LabelOf }) {
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
            <bdi>{afterLabel(row, labelOf)}</bdi>
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

/** ⚠️ ארבע העובדות במילים, לטלפון. אותו סדר כמו עמודות הטבלה. */
function Facts({ person }: { person: PersonRow }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
      <span>
        {t.releases.colReleases} <Count value={person.releases} />
        {person.byManager > 0 && ` (${t.releases.byManagerCount(person.byManager)})`}
      </span>
      <span>
        {t.releases.colLate} <Count value={person.late} alert />
      </span>
      <span>
        {t.releases.colUncovered} <Count value={person.uncovered} alert />
      </span>
      <span className={person.month === 'none' ? 'font-medium text-danger' : ''}>
        {t.releases.colOther}: {monthVerdict(person)}
      </span>
    </p>
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
    // ⚠️ כל השורות ולא רק השחרורים: כדי לדעת אם אדם חזר למשמרת שהוא שחרר
    // צריך לראות גם את הלקיחות. רשומה 32.
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

  const labelOf: LabelOf = (id) => labels.get(id);
  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));
  const moveMonth = (delta: number) => {
    setMonthKey((key) => addMonths(key, delta));
    setOpenId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{monthLabel(monthKey)}</h3>
        <div className="flex gap-2">
          <Button tone="secondary" size="sm" onClick={() => moveMonth(-1)}>
            {t.releases.prevMonth}
          </Button>
          <Button tone="secondary" size="sm" onClick={() => moveMonth(1)}>
            {t.releases.nextMonth}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
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
        <>
          {/* ⚠️ בטלפון: שורה מקופלת לכל אדם. ⚠️ ואינה רשת כרטיסים: אותן
              עובדות, אותו סדר, שורה מתחת לשורה. */}
          <ul className="flex flex-col divide-y divide-line sm:hidden">
            {report.rows.map((person) => {
              const open = openId === person.memberId;
              return (
                <li key={person.memberId} className="flex flex-col gap-1 py-2">
                  <PersonName
                    label={labelOf(person.memberId)}
                    open={open}
                    onToggle={() => toggle(person.memberId)}
                  />
                  <Facts person={person} />
                  {open && (
                    <div className="mt-1 rounded-card bg-surface-sunken px-3">
                      <Details person={person} labelOf={labelOf} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* ⚠️ במסך רחב: טבלה. CLAUDE.md, עיצוב. */}
          <table className="hidden w-full table-fixed text-sm sm:table">
            <thead>
              <tr className="border-b border-line text-xs text-ink-soft">
                <th scope="col" className="w-[32%] py-2 pe-2 text-start font-medium">
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
                <th scope="col" className="w-[22%] py-2 text-start font-medium">
                  {t.releases.colOther}
                </th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((person) => {
                const open = openId === person.memberId;
                // ⚠️ Fragment עם מפתח: שתי שורות לאדם, השנייה רק כשהוא פתוח.
                return (
                  <Fragment key={person.memberId}>
                    <tr className="border-t border-line align-top">
                      <td className="py-2 pe-2">
                        <PersonName
                          label={labelOf(person.memberId)}
                          open={open}
                          onToggle={() => toggle(person.memberId)}
                        />
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
                          <Details person={person} labelOf={labelOf} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
