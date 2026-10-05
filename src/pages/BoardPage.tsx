// src/pages/BoardPage.tsx

import { useMemo, useState } from 'react';
import {
  useStore,
  groupActivityByDate,
  groupShiftsByDate,
  selectHandoverCount,
  selectOpenShiftCount,
} from '../store/useStore';
import { MonthBoard } from '../components/board/MonthBoard';
import { DayList } from '../components/board/DayList';
import { AccessCodePanel } from '../components/board/AccessCodePanel';
import { MembersPanel } from '../components/admin/MembersPanel';
import { t } from '../i18n/dictionary';
import { addMonths, datesInMonth, monthLabel, toMonthKey } from '../utils/dates';
import { codeVisibilityFor } from '../utils/eligibility';
import {
  DEFAULT_BRANCH_ID,
  cancelHandoverRequest,
  claimShift,
  generateMonth,
  releaseShift,
  requestHandover,
} from '../services/salonService';
import type { Shift } from '../types';
import { toReadableError } from '../utils/errors';

export function BoardPage() {
  const branch = useStore((state) => state.branch);
  const member = useStore((state) => state.member);
  const monthKey = useStore((state) => state.monthKey);
  const setMonthKey = useStore((state) => state.setMonthKey);
  const shifts = useStore((state) => state.shifts);
  const codes = useStore((state) => state.accessCodes);
  const isMonthLoading = useStore((state) => state.isMonthLoading);
  const setError = useStore((state) => state.setError);

  const activityDays = useStore((state) => state.activityDays);
  const openCount = useStore(selectOpenShiftCount);
  const handoverCount = useStore(selectHandoverCount);

  // ⚠️ ב-useMemo ולא בבורר. בורר שבונה Map חדש בכל קריאה גורם ללולאה
  // אינסופית, וזה קרה. DOCS/PLANING/16-the-selector-that-looped.md
  const shiftsByDate = useMemo(() => groupShiftsByDate(shifts), [shifts]);
  const activityByDate = useMemo(() => groupActivityByDate(activityDays), [activityDays]);

  const [generating, setGenerating] = useState(false);

  const canAct = member?.status === 'active';
  const isManager = member?.role === 'manager';

  const visibility = useMemo(
    () => codeVisibilityFor(shifts, codes, member?.id ?? ''),
    [shifts, codes, member?.id],
  );

  // ימי השבוע שיש להם תבנית פעילה. בחיפה זה אינו ראשון עד חמישי.
  const activeDates = useMemo(() => {
    if (!branch) return [];
    const weekdays = new Set<number>();
    for (const template of branch.shiftTemplates) {
      if (!template.isActive) continue;
      for (const day of template.weekdays) weekdays.add(day);
    }
    return datesInMonth(monthKey, [...weekdays]);
  }, [branch, monthKey]);

  async function guarded(run: () => Promise<void>) {
    try {
      setError(null);
      await run();
    } catch (error) {
      setError(toReadableError(error, t.shift.claimFailed));
    }
  }

  const onClaim = (shift: Shift) =>
    guarded(() =>
      claimShift(DEFAULT_BRANCH_ID, shift.id, member!.id, member!.displayName),
    );
  const onRelease = (shift: Shift) => guarded(() => releaseShift(DEFAULT_BRANCH_ID, shift.id));
  const onRequestHandover = (shift: Shift) =>
    guarded(() => requestHandover(DEFAULT_BRANCH_ID, shift.id));
  const onCancelHandover = (shift: Shift) =>
    guarded(() => cancelHandoverRequest(DEFAULT_BRANCH_ID, shift.id));

  if (!branch) {
    return <p className="p-6 text-ink-soft">{t.errors.noBranch}</p>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <AccessCodePanel visibility={visibility} />

      {isManager && <MembersPanel />}

      <section className="rounded-xl border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
          <div className="flex items-center gap-2">
            {/* ⚠️ חצי חודש. בעברית חודש קודם הוא לכיוון ימין, ולכן לא מראה חץ עיוור. */}
            <button
              type="button"
              onClick={() => setMonthKey(addMonths(monthKey, -1))}
              className="rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-brand-soft"
            >
              {t.board.previousMonth}
            </button>
            <h1 className="min-w-40 text-center text-lg font-semibold">{monthLabel(monthKey)}</h1>
            <button
              type="button"
              onClick={() => setMonthKey(addMonths(monthKey, 1))}
              className="rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-brand-soft"
            >
              {t.board.nextMonth}
            </button>
            {monthKey !== toMonthKey(new Date()) && (
              <button
                type="button"
                onClick={() => setMonthKey(toMonthKey(new Date()))}
                className="rounded-md px-2 py-1 text-sm text-ink-faint underline-offset-2 hover:underline"
              >
                {t.board.today}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={openCount > 0 ? 'text-shift-open-ink' : 'text-ink-soft'}>
              {openCount > 0 ? t.board.openShifts(openCount) : t.board.noOpenShifts}
            </span>
            {handoverCount > 0 && (
              <span className="text-shift-handover-ink">
                {t.board.handoverWaiting(handoverCount)}
              </span>
            )}
          </div>
        </header>

        {isMonthLoading ? (
          <p className="p-6 text-ink-soft">{t.board.loading}</p>
        ) : shifts.length === 0 ? (
          <div className="flex flex-col items-start gap-3 p-6">
            <p className="text-ink-soft">{t.board.empty}</p>
            {isManager && (
              <button
                type="button"
                disabled={generating}
                onClick={() => {
                  setGenerating(true);
                  void generateMonth(DEFAULT_BRANCH_ID, monthKey)
                    .catch((error: unknown) => setError(toReadableError(error, t.errors.saveFailed)))
                    .finally(() => setGenerating(false));
                }}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-50"
              >
                {generating ? t.board.generating : t.board.generate}
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
                dates={activeDates}
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
      </section>
    </div>
  );
}
