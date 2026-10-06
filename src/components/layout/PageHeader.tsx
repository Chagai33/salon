// src/components/layout/PageHeader.tsx
//
// הכותרת של מסך העבודה, והיא גם הכותרת היחידה שלו.
//
// ⚠️⚠️ שלוש שורות, נעוצות, בסדר שבעל המוצר קבע 06/10:
//   1. הסלון, ומשמאלו הקוד, היציאה, מצב כהה והתפריט.
//   2. החודש, באמצע.
//   3. מה שדורש טיפול, באמצע.
// DOCS/PLANING/26
//
// ⚠️ ומה שאינו כאן, בהכרעתו: שעות הסלון, כפתור העתקה, המילה "תפריט",
// והמילים "קוד הכניסה" לפני הספרות.

import { useEffect, useRef, useState } from 'react';
import type { CodeVisibility } from '../../utils/eligibility';
import { t } from '../../i18n/dictionary';
import { addMonths, monthLabel, toMonthKey } from '../../utils/dates';
import { firstName } from '../../utils/names';
import { AccessCodePanel } from '../board/AccessCodePanel';
import { StatusLine } from './StatusLine';
import type { StatusItem } from './StatusLine';
import { ThemeToggle } from './ThemeToggle';
import { ChevronDown, ChevronLeft, ChevronRight, Hamburger, SignOut, Users } from './Icons';

export interface SalonOption {
  id: string;
  name: string;
}

interface Props {
  branchName: string;
  /** ⚠️ הסלונים שאני חבר בהם. רשימה של אחד אינה בחירה, ואז אין חץ. */
  salons: SalonOption[];
  monthKey: string;
  visibility: CodeVisibility;
  status: StatusItem[];
  memberName: string;
  /** ⚠️ למנהלת בלבד: אייקון החברים, ועיגול כשיש מי שמחכה לאישור. */
  pendingCount?: number;
  /** ⚠️ null כשאין מה לפתוח. לחבר אין תפריט בכלל. */
  onOpenMenu: (() => void) | null;
  onOpenMembers?: () => void;
  onMonthChange: (monthKey: string) => void;
  onPickSalon: (branchId: string) => void;
  onSignOut: () => void;
}

export function PageHeader({
  branchName,
  salons,
  monthKey,
  visibility,
  status,
  memberName,
  pendingCount = 0,
  onOpenMenu,
  onOpenMembers,
  onMonthChange,
  onPickSalon,
  onSignOut,
}: Props) {
  const isCurrentMonth = monthKey === toMonthKey(new Date());
  const [salonsOpen, setSalonsOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /*
    ⚠️ רשימה נפתחת קטנה, ולא מעבר למסך אחר.
    בלשון בעל המוצר, 06/10: "בלחיצה על החלפת סלון אין טעם להעביר אותי לתפריט
    של בקשת ההצטרפות, מספיק שהיה נפתח לי drop down קטן, וגם אין לי מהמסך הזה
    איך לחזור אחורה". DOCS/PLANING/26
  */
  useEffect(() => {
    if (!salonsOpen) return;
    function away(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setSalonsOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSalonsOpen(false);
    }
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [salonsOpen]);

  const icon =
    'grid size-9 place-items-center rounded-lg text-ink-soft hover:bg-brand-soft hover:text-ink';

  /** ⚠️ נבנה פעם אחת ומוצג במקום אחד בלבד בכל רוחב. */
  const monthNav = (
    <nav aria-label={t.board.title} className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onMonthChange(addMonths(monthKey, -1))}
        aria-label={t.board.previousMonth}
        title={t.board.previousMonth}
        className={icon}
      >
        <ChevronRight />
      </button>

      <span className="min-w-28 text-center text-base font-medium text-ink">
        {monthLabel(monthKey)}
      </span>

      <button
        type="button"
        onClick={() => onMonthChange(addMonths(monthKey, 1))}
        aria-label={t.board.nextMonth}
        title={t.board.nextMonth}
        className={icon}
      >
        <ChevronLeft />
      </button>

      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => onMonthChange(toMonthKey(new Date()))}
          className="rounded-lg px-2 py-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          {t.board.today}
        </button>
      )}
    </nav>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-1.5">
        {/* שורה 1 */}
        <div className="flex min-w-0 items-center gap-1">
          <div ref={box} className="relative min-w-0">
            {salons.length > 1 ? (
              <button
                type="button"
                onClick={() => setSalonsOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={salonsOpen}
                title={t.salons.switch}
                className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-base font-semibold text-ink hover:bg-brand-soft"
              >
                <bdi className="truncate">{branchName}</bdi>
                <ChevronDown />
              </button>
            ) : (
              <h1 className="truncate px-1.5 py-1 text-base font-semibold text-ink">
                <bdi>{branchName}</bdi>
              </h1>
            )}

            {salonsOpen && (
              <ul
                role="listbox"
                className="absolute top-full z-40 mt-1 min-w-48 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-soft"
              >
                {salons.map((salon) => (
                  <li key={salon.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSalonsOpen(false);
                        onPickSalon(salon.id);
                      }}
                      className="flex min-h-10 w-full items-center px-3 text-start text-sm text-ink hover:bg-brand-soft"
                    >
                      <bdi>{salon.name}</bdi>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ⚠️ בדסקטופ בלבד. בטלפון הם שתי שורות משלהם. */}
          <div className="ms-6 hidden items-center gap-4 md:flex">
            {monthNav}
            <StatusLine items={status} />
          </div>

          <div className="ms-auto flex items-center gap-1">
            {/* ⚠️ הספרות בלבד, בלי המילים "קוד הכניסה", בשתי התצוגות. */}
            <AccessCodePanel visibility={visibility} inline />

            {onOpenMembers && (
              <button
                type="button"
                onClick={onOpenMembers}
                aria-label={t.manager.membersTitle}
                title={t.manager.membersTitle}
                className={`${icon} relative`}
              >
                <Users />
                {/* ⚠️ עיגול, ו-sr-only אומר כמה. צבע לבד אינו סימן. */}
                {pendingCount > 0 && (
                  <>
                    <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-danger" />
                    <span className="sr-only">{t.board.joinRequests(pendingCount)}</span>
                  </>
                )}
              </button>
            )}

            <span className="hidden text-sm text-ink-soft sm:inline">
              <bdi>{firstName(memberName)}</bdi>
            </span>

            <button
              type="button"
              onClick={onSignOut}
              aria-label={t.auth.signOut}
              title={t.auth.signOut}
              className={icon}
            >
              <SignOut />
            </button>

            <ThemeToggle />

            {onOpenMenu && (
              <button
                type="button"
                onClick={onOpenMenu}
                aria-haspopup="dialog"
                aria-label={t.menu.open}
                title={t.menu.open}
                className={icon}
              >
                <Hamburger />
              </button>
            )}
          </div>
        </div>

        {/*
          שורה 2 בטלפון בלבד.
          ⚠️ בדסקטופ החודש יושב בשורה הראשונה, בהכרעת בעל המוצר 06/10: "לא
          הבנתי למה עשית את זה ככה בגרסת דסקטופ, יש מקום פנוי למעלה והוא לא
          מנוצל". DOCS/PLANING/26
        */}
        <div className="flex justify-center md:hidden">{monthNav}</div>

        {/* שורה 3 בטלפון בלבד. ⚠️ ואפס אינו נכנס לשורה. */}
        {status.length > 0 && (
          <div className="flex justify-center pb-0.5 md:hidden">
            <StatusLine items={status} />
          </div>
        )}
      </div>
    </header>
  );
}
