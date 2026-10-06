// src/pages/BoardPage.tsx
//
// מסך העבודה. ⚠️ ואינו דאשבורד של מדדים.
//
// הסדר כאן הוא הכרעה: מי אני ואיפה, מה דורש טיפול, אזור העבודה, ואחר כך
// המשני. קוד הדלת היה בראש העמוד בכרטיס גדול, וזה הפך מידע משני לכותרת.
//
// ⚠️ ומה שאפס אינו מוצג. חודש בלי משמרות אינו "הכל מסודר", הוא מצב שצריך
// הכוונה, ולכן יש לו כותרת ופעולה אחת.

import { useMemo, useState } from 'react';
import {
  useStore,
  groupActivityByDate,
  groupShiftsByDate,
  selectHandoverCount,
  selectOpenShiftCount,
  splitMembers,
} from '../store/useStore';
import { MonthBoard } from '../components/board/MonthBoard';
import { DayList } from '../components/board/DayList';
import { AccessCodePanel } from '../components/board/AccessCodePanel';
import { Legend } from '../components/board/Legend';
import { DayEditor } from '../components/board/DayEditor';
import { ImportBoardImage } from '../components/admin/ImportBoardImage';
import { MembersPanel } from '../components/admin/MembersPanel';
import { PageHeader } from '../components/layout/PageHeader';
import { StatusLine } from '../components/layout/StatusLine';
import type { StatusItem } from '../components/layout/StatusLine';
import { t } from '../i18n/dictionary';
import { datesInMonth, monthNameOf } from '../utils/dates';
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
  const user = useStore((state) => state.user);
  const monthKey = useStore((state) => state.monthKey);
  const setMonthKey = useStore((state) => state.setMonthKey);
  const shifts = useStore((state) => state.shifts);
  const members = useStore((state) => state.members);
  const codes = useStore((state) => state.accessCodes);
  const isMonthLoading = useStore((state) => state.isMonthLoading);
  const setError = useStore((state) => state.setError);
  const canOpenBranch = useStore((state) => state.canOpenBranch);

  const activityDays = useStore((state) => state.activityDays);
  const openCount = useStore(selectOpenShiftCount);
  const handoverCount = useStore(selectHandoverCount);

  // ⚠️ ב-useMemo ולא בבורר. בורר שבונה Map או מערך חדש בכל קריאה גורם ללולאה
  // אינסופית, וזה קרה. DOCS/PLANING/16-the-selector-that-looped.md
  const shiftsByDate = useMemo(() => groupShiftsByDate(shifts), [shifts]);
  const activityByDate = useMemo(() => groupActivityByDate(activityDays), [activityDays]);
  const { pending } = useMemo(() => splitMembers(members), [members]);

  const [generating, setGenerating] = useState(false);
  /** היום שהמנהלת פתחה לעריכה. ⚠️ null פירושו שהעורך סגור. */
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const canAct = member?.status === 'active';
  const isManager = member?.role === 'manager';
  const canManageMembers = isManager || canOpenBranch;

  const visibility = useMemo(
    () => codeVisibilityFor(shifts, codes, member?.id ?? ''),
    [shifts, codes, member?.id],
  );

  /*
    ⚠️ כל ימי החודש, ולא רק הימים שיש להם משמרת.
    קודם הלוח צייר ראשון עד חמישי בלבד, ולכן שישי ושבת לא היו קיימים בו בכלל.
    ובהכרעת בעל המוצר 06/10 הם כן קיימים: הסלון פתוח בהם לחברי האופן ספייס
    וסגור למי שאינו חבר, וזה מידע שחבר צריך.
  */
  const allDates = useMemo(() => datesInMonth(monthKey, [0, 1, 2, 3, 4, 5, 6]), [monthKey]);

  /** שמות החגים של החודש. ⚠️ מידע ולא מדיניות, רשומה 14. */
  const namedDays = useMemo(() => namedDaysOfMonth(monthKey), [monthKey]);

  async function guarded(run: () => Promise<void>) {
    try {
      setError(null);
      await run();
    } catch (error) {
      setError(toReadableError(error, t.shift.claimFailed));
    }
  }

  const onClaim = (shift: Shift) =>
    guarded(() => claimShift(branchId, shift.id, member!.id, member!.displayName));
  const onRelease = (shift: Shift) => guarded(() => releaseShift(branchId, shift.id));
  const onRequestHandover = (shift: Shift) =>
    guarded(() => requestHandover(branchId, shift.id));
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
  // ⚠️ ומספר החברים אינו בשורה. הוא כתוב בכרטיס החברים ממילא, ומונה שחוזר
  // פעמיים אינו מוסיף מידע.

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5">
      <PageHeader
        name={member?.displayName ?? user?.displayName ?? ''}
        branchName={branch.name}
        monthKey={monthKey}
        onMonthChange={setMonthKey}
      />

      <StatusLine items={status} />

      {/* ⚠️ לחבר הקוד הוא העיקר, ולכן הוא לפני הלוח. למנהלת הוא יורד לאזור
          המשני בתחתית, ושם הוא קומפקטי. */}
      {!canManageMembers && (
        /* ⚠️ ברוחב התוכן ולא ברוחב העמוד. קוד של ארבע ספרות בכרטיס שנמתח על
           1280 פיקסלים הוא בעיקר חלל ריק. */
        <div className="max-w-md">
          <AccessCodePanel visibility={visibility} />
        </div>
      )}

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
                className="mt-5 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
              >
                {generating ? t.board.generating : t.board.generateFor(monthName)}
              </button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {/*
              ⚠️ שתי תצוגות לאותו מידע, ולא טבלה שגוללת לצדדים.
              חמש עמודות ברוחב טלפון דורשות גלילה אופקית, וזה מה שגורם לאנשים
              לוותר על לוח שנועד לסריקה מהירה.
            */}
            <div className="md:hidden">
              <DayList
                branch={branch}
                dates={allDates}
                namedDays={namedDays}
                shiftsByDate={shiftsByDate}
                activityByDate={activityByDate}
                memberId={member?.id ?? null}
                canAct={canAct}
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
                onPickDay={isManager ? setPickedDay : undefined}
                shiftsByDate={shiftsByDate}
                activityByDate={activityByDate}
                memberId={member?.id ?? null}
                canAct={canAct}
                onClaim={onClaim}
                onRelease={onRelease}
                onRequestHandover={onRequestHandover}
                onCancelHandover={onCancelHandover}
              />
            </div>
          </div>
        )}

        {/* ⚠️ מתחת ללוח ולא בתוך התא, ורק למנהלת שבחרה יום. */}
        {isManager && pickedDay && (
          <DayEditor
            branchId={branchId}
            dateKey={pickedDay}
            day={activityByDate.get(pickedDay)}
            name={namedDays.get(pickedDay)}
            onClose={() => setPickedDay(null)}
          />
        )}

        {hasShifts && !isMonthLoading && <Legend />}
      </main>

      {/*
        האזור המשני.
        ⚠️ לחבר קוד הדלת הוא העיקר, ולמנהלת הוא מידע נגיש ולא כותרת. לכן אותו
        רכיב בשתי צורות, והזכאות עצמה אינה משתנה בשום מצב.
      */}
      {/* ⚠️ למנהלת הסניף בלבד. מנהל מערכת שאינו מנהל כאן אינו כותב ימים. */}
      {isManager && <ImportBoardImage branchId={branchId} monthKey={monthKey} />}

      {/* ⚠️ items-start, אחרת הכרטיס הקצר נמתח לגובה הארוך ונוצר חלל מת. */}
      {canManageMembers ? (
        <div className="grid items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
          <MembersPanel branchId={branchId} />
          <AccessCodePanel
            visibility={visibility}
            compact
            onSetCode={(code) => setAccessCode(branchId, code, member!.id)}
          />
        </div>
      ) : null}
    </div>
  );
}
