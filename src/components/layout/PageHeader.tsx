// src/components/layout/PageHeader.tsx
//
// הכותרת של מסך העבודה: מי אני, איפה אני, ובאיזה חודש.
//
// ⚠️ והסניף והחודש מגיעים מהמצב ואינם טקסט קשיח. מעבר החודש יושב כאן ולא
// בתוך כרטיס הלוח, כדי שלא תהיה שורת כותרת שנייה בעמוד אחד.

import { t } from '../../i18n/dictionary';
import { addMonths, monthLabel, toMonthKey } from '../../utils/dates';

interface Props {
  name: string;
  branchName: string;
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
}

export function PageHeader({ name, branchName, monthKey, onMonthChange }: Props) {
  const isCurrentMonth = monthKey === toMonthKey(new Date());

  // ⚠️ חץ בלי טקסט אינו קריא לקורא מסך, ובעברית גם הכיוון שלו מבלבל.
  // לכן המילה היא הכפתור, והחץ אינו קיים.
  const step =
    'rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-brand-soft hover:text-ink';

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {t.home.greeting(name)}
        </h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          {t.home.place(branchName, monthLabel(monthKey))}
        </p>
      </div>

      <nav aria-label={t.board.title} className="flex items-center gap-1">
        <button type="button" onClick={() => onMonthChange(addMonths(monthKey, -1))} className={step}>
          {t.board.previousMonth}
        </button>
        <button type="button" onClick={() => onMonthChange(addMonths(monthKey, 1))} className={step}>
          {t.board.nextMonth}
        </button>
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={() => onMonthChange(toMonthKey(new Date()))}
            className="rounded-lg px-3 py-2 text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            {t.board.today}
          </button>
        )}
      </nav>
    </header>
  );
}
