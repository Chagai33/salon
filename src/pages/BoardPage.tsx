// src/pages/BoardPage.tsx
//
// מסך העבודה. ⚠️ ואינו דאשבורד של מדדים.
//
// ⚠️⚠️ וארבעה דברים בלבד: כותרת, רצועת הקוד, הלוח, המקרא.
// החברים, הייבוא והגדרת הקוד ישבו פרושים בתחתית העמוד, ועברו לתפריט שבצד.
// DOCS/PLANING/26
//
// ⚠️ ומה שאפס אינו מוצג. חודש בלי משמרות אינו "הכל מסודר", הוא מצב שצריך
// הכוונה, ולכן יש לו כותרת ופעולה אחת.

import { useMemo, useState } from 'react';
import {
  useStore,
  groupActivityByDate,
  groupShiftsByDate,
  countOpenShifts,
  selectHandoverCount,
  shutDatesOf,
  splitMembers,
} from '../store/useStore';
import { MonthBoard } from '../components/board/MonthBoard';
import { WeekAccordion } from '../components/board/WeekAccordion';
import { AccessCodePanel } from '../components/board/AccessCodePanel';
import { Legend } from '../components/board/Legend';
import { DaySheet } from '../components/board/DaySheet';
import { ImportBoardImage } from '../components/admin/ImportBoardImage';
import { MembersPanel } from '../components/admin/MembersPanel';
import { PageHeader } from '../components/layout/PageHeader';
import { SideMenu } from '../components/layout/SideMenu';
import { Sheet } from '../components/common/Sheet';
import { signOutOfSalon } from '../hooks/useSalon';
import { useNavigate } from 'react-router-dom';
import type { StatusItem } from '../components/layout/StatusLine';
import { t } from '../i18n/dictionary';
import { monthNameOf } from '../utils/dates';
import { namedDaysOfMonth } from '../utils/hebrew';
import { codeVisibilityFor } from '../utils/eligibility';
import {
  cancelHandoverRequest,
  claimShift,
  generateMonth,
  releaseShift,
  requestHandover,
  setAccessCode,
} from '../services/salonService';
import type { Shift } from '../types';
import { toReadableError } from '../utils/errors';

export function BoardPage({ branchId }: { branchId: string }) {
  const branch = useStore((state) => state.branch);
  const member = useStore((state) => state.member);
  const monthKey = useStore((state) => state.monthKey);
  const setMonthKey = useStore((state) => state.setMonthKey);
  const shifts = useStore((state) => state.shifts);
  const members = useStore((state) => state.members);
  const codes = useStore((state) => state.accessCodes);
  const isMonthLoading = useStore((state) => state.isMonthLoading);
  const setError = useStore((state) => state.setError);
  const canOpenBranch = useStore((state) => state.canOpenBranch);
  const branches = useStore((state) => state.branches);
  const memberships = useStore((state) => state.myMemberships);

  const activityDays = useStore((state) => state.activityDays);
  const handoverCount = useStore(selectHandoverCount);

  // ⚠️ ב-useMemo ולא בבורר. בורר שבונה Map או מערך חדש בכל קריאה גורם ללולאה
  // אינסופית, וזה קרה. DOCS/PLANING/16-the-selector-that-looped.md
  const shiftsByDate = useMemo(() => groupShiftsByDate(shifts), [shifts]);
  const activityByDate = useMemo(() => groupActivityByDate(activityDays), [activityDays]);
  const { pending } = useMemo(() => splitMembers(members), [members]);

  /*
    ⚠️ יום שהמנהלת סגרה אינו מציג משמרת, ולכן אינו נספר.
    בלשון בעל המוצר, 06/10: "אם המנהלת בחרה שהסלון סגור לחברים ביום מסויים אז
    אין סיבה שתיספר שיש משמרת פתוחה". DOCS/PLANING/26
  */
  const shutDates = useMemo(() => shutDatesOf(activityDays), [activityDays]);
  const openCount = useMemo(() => countOpenShifts(shifts, shutDates), [shifts, shutDates]);

  /** הסלונים שאני חבר בהם. ⚠️ רשימה של אחד אינה בחירה. */
  const salons = useMemo(
    () =>
      branches
        .filter((candidate) => memberships[candidate.id])
        .map((candidate) => ({ id: candidate.id, name: candidate.name })),
    [branches, memberships],
  );

  const [generating, setGenerating] = useState(false);
  /** היום שנפתח בגיליון. ⚠️ null פירושו שהגיליון סגור. */
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  const canAct = member?.status === 'active';
  const isManager = member?.role === 'manager';
  const canManageMembers = isManager || canOpenBranch;

  const visibility = useMemo(
    () => codeVisibilityFor(shifts, codes, member?.id ?? ''),
    [shifts, codes, member?.id],
  );

  /** שמות החגים של החודש. ⚠️ מידע ולא מדיניות, רשומה 14. */
  const namedDays = useMemo(() => namedDaysOfMonth(monthKey), [monthKey]);

  /*
    ⚠️ שעות הסלון ירדו מהכותרת, בהכרעת בעל המוצר 06/10: "אין צורך לכתוב
    ב-HEADER ראשון עד חמישי, 10:00-22:00". הן מוגדרות בסניף, והחריג הוא מה
    שנאמר ליום. DOCS/PLANING/26
  */

  async function guarded(run: () => Promise<void>) {
    try {
      setError(null);
      await run();
    } catch (error) {
      setError(toReadableError(error, t.shift.claimFailed));
    }
  }

  /** ⚠️ אותו מנעול לשני המסכים, כדי שלא תהיה לחיצה כפולה מגיליון היום. */
  async function run(shift: Shift, fn: (shift: Shift) => Promise<void>) {
    setBusyId(shift.id);
    try {
      await fn(shift);
    } finally {
      setBusyId(null);
    }
  }

  const onClaim = (shift: Shift) =>
    guarded(() => claimShift(branchId, shift.id, member!.id, member!.displayName));
  const onRelease = (shift: Shift) => guarded(() => releaseShift(branchId, shift.id));
  const onRequestHandover = (shift: Shift) => guarded(() => requestHandover(branchId, shift.id));
  const onCancelHandover = (shift: Shift) =>
    guarded(() => cancelHandoverRequest(branchId, shift.id));

  if (!branch) {
    return <p className="p-6 text-ink-soft">{t.errors.noBranch}</p>;
  }

  const hasShifts = shifts.length > 0;
  const monthName = monthNameOf(monthKey);

  // ⚠️ מה שאפס אינו נכנס לשורה. ובקשות הצטרפות נראות גם כשרשימת החברים
  // המלאה מקופלת, כי הן מה שדורש טיפול.
  const status: StatusItem[] = [];
  // ⚠️ משמרת פתוחה היא מצב ולא תקלה, ולכן היא שקטה. מה שצבוע הוא מה שמחכה
  // להכרעה של אדם: בקשת מחליף ובקשת הצטרפות.
  if (hasShifts) {
    status.push(
      openCount > 0
        ? { key: 'open', label: t.board.openShifts(openCount) }
        : { key: 'open', label: t.board.noOpenShifts, tone: 'good' },
    );
  }
  if (handoverCount > 0) {
    status.push({
      key: 'handover',
      label: t.board.handoverWaiting(handoverCount),
      tone: 'attention',
    });
  }
  if (canManageMembers && pending.length > 0) {
    status.push({
      key: 'pending',
      label: t.board.joinRequests(pending.length),
      tone: 'attention',
    });
  }

  return (
    <>
      {/*
        ⚠️⚠️ כותרת אחת, נעוצה, וכל מה שהיה מעל הלוח בתוכה.
        הקוד, החודש, השעות והתפריט. בעל המוצר מדד על מסך 14 אינץ שהלוח התחיל
        מתחת לקפל. DOCS/PLANING/26
        ⚠️ ורצועת הקוד מוצגת גם למנהלת, לקריאה, בהכרעת 06/10.
      */}
      <PageHeader
        branchName={branch.name}
        monthKey={monthKey}
        visibility={visibility}
        status={status}
        salons={salons}
        memberName={member?.displayName ?? ''}
        pendingCount={canManageMembers ? pending.length : 0}
        onOpenMembers={canManageMembers ? () => setMembersOpen(true) : undefined}
        /* ⚠️ אין כפתור תפריט כשאין בו דבר. לחבר הכל כבר בכותרת. */
        onOpenMenu={isManager ? () => setMenuOpen(true) : null}
        onMonthChange={setMonthKey}
        onPickSalon={(id) => navigate(`/s/${id}`)}
        onSignOut={() => void signOutOfSalon()}
      />

      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">

      {/* אזור העבודה. ⚠️ אין בו כותרת שנייה: החודש והסניף כבר בכותרת העמוד. */}
      {/* ⚠️ tabIndex={-1} כדי שקישור הדילוג יוכל להעביר לכאן מיקוד. */}
      <main
        id="main"
        tabIndex={-1}
        className="rounded-board border border-line bg-surface shadow-soft"
      >
        {isMonthLoading ? (
          <p className="p-5 text-ink-soft">{t.board.loading}</p>
        ) : !hasShifts ? (
          /* ⚠️ ממורכז ולא נצמד לצד: תוכן בצד אחד של כרטיס רחב משאיר חלל גדול
             בצד השני, וזה נקרא כמו משהו שלא נטען. */
          <div className="mx-auto max-w-md px-5 py-10 text-center">
            <h2 className="text-lg font-semibold text-ink">{t.board.emptyTitle(monthName)}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {isManager ? t.board.emptyBodyManager : t.board.emptyBodyMember}
            </p>

            {/* ⚠️ פעולה אחת, ורק למי שהמסד יתיר לו אותה. יצירת משמרות דורשת
                תפקיד מנהלת בסניף הזה, ולא הרשאת מנהל מערכת. */}
            {isManager && (
              <button
                type="button"
                disabled={generating}
                onClick={() => {
                  setGenerating(true);
                  void generateMonth(branchId, monthKey)
                    .catch((error: unknown) => setError(toReadableError(error, t.errors.saveFailed)))
                    .finally(() => setGenerating(false));
                }}
                className="mt-5 min-h-11 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
              >
                {generating ? t.board.generating : t.board.generateFor(monthName)}
              </button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {/*
              ⚠️ שתי תצוגות לאותו מידע, ולא טבלה שגוללת לצדדים.
              בטלפון אקורדיון שבועי, בהכרעת בעל המוצר 06/10: נפתח השבוע שהיום
              נמצא בו, כלומר שבעה ימים במקום 31.
            */}
            <div className="md:hidden">
              <WeekAccordion
                branch={branch}
                monthKey={monthKey}
                namedDays={namedDays}
                shiftsByDate={shiftsByDate}
                activityByDate={activityByDate}
                memberId={member?.id ?? null}
                canAct={canAct}
                canEdit={isManager}
                onPickDay={setPickedDay}
                onClaim={onClaim}
                onRelease={onRelease}
                onRequestHandover={onRequestHandover}
                onCancelHandover={onCancelHandover}
              />
            </div>
            <div className="hidden md:block">
              <MonthBoard
                branch={branch}
                monthKey={monthKey}
                namedDays={namedDays}
                onPickDay={setPickedDay}
                shiftsByDate={shiftsByDate}
                activityByDate={activityByDate}
                memberId={member?.id ?? null}
                canEdit={isManager}
              />
            </div>
          </div>
        )}

        {hasShifts && !isMonthLoading && <Legend />}
      </main>

      {/* ⚠️ גיליון היום: מה שנחתך מהתא, והפעולות. ולמנהלת גם העורך. */}
      {pickedDay && (
        <DaySheet
          branchId={branchId}
          dateKey={pickedDay}
          day={activityByDate.get(pickedDay)}
          name={namedDays.get(pickedDay)}
          shifts={shiftsByDate.get(pickedDay) ?? []}
          memberId={member?.id ?? null}
          canAct={canAct}
          isManager={isManager}
          busyId={busyId}
          onClose={() => setPickedDay(null)}
          onClaim={(shift) => void run(shift, onClaim)}
          onRelease={(shift) => void run(shift, onRelease)}
          onRequestHandover={(shift) => void run(shift, onRequestHandover)}
          onCancelHandover={(shift) => void run(shift, onCancelHandover)}
        />
      )}

      {/* ⚠️ החברים בגיליון משלהם, מאייקון בכותרת. */}
      {membersOpen && canManageMembers && (
        <Sheet title={t.manager.membersTitle} onClose={() => setMembersOpen(false)}>
          <MembersPanel branchId={branchId} />
        </Sheet>
      )}

      {/*
        ⚠️ התפריט מחזיק רק את מה שאין לו מקום אחר, ולמנהלת בלבד.
        ⚠️⚠️ ובלי הקוד עצמו: בהכרעת בעל המוצר 06/10 "אין טעם להציג את הקוד
        אלא רק כפתור החלפת הקוד". הוא כבר בכותרת. DOCS/PLANING/26
      */}
      {menuOpen && isManager && (
        <SideMenu onClose={() => setMenuOpen(false)}>
          <AccessCodePanel
            visibility={visibility}
            formOnly
            onSetCode={(code) => setAccessCode(branchId, code, member!.id)}
          />

          {/* ⚠️ למנהלת הסניף בלבד. מנהל מערכת שאינו מנהל כאן אינו כותב ימים. */}
          {/* ⚠️ ו-activityByDate נמסר כדי שהייבוא ידע מה הוא מחליף. רשומה 25. */}
          <ImportBoardImage
            branchId={branchId}
            monthKey={monthKey}
            activityByDate={activityByDate}
            /* ⚠️ פותח את גיליון היום, ובתוכו העורך הרגיל. ⚠️ וסוגר את
               התפריט, אחרת הגיליון נפתח מאחוריו. */
            onOpenDay={(date) => {
              setMenuOpen(false);
              setPickedDay(date);
            }}
            /* ⚠️ וגם התפריט נסגר, כדי שהלוח יהיה מה שרואים אחרי הייבוא. */
            onFinished={() => setMenuOpen(false)}
          />
        </SideMenu>
      )}
      </div>
    </>
  );
}
