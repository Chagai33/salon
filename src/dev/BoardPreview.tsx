// src/dev/BoardPreview.tsx
//
// ⚠️ תצוגה מקדימה לפיתוח בלבד, ואינה חלק מהמוצר.
// היא קיימת כדי לראות את הלוח בלי להתחבר ל-Google, ובלי לכתוב למסד.
// הנתונים כאן מומצאים. שמות החברים הם אותיות, ולא אנשים אמיתיים.

import { MonthBoard } from '../components/board/MonthBoard';
import { DayList } from '../components/board/DayList';
import { AccessCodePanel } from '../components/board/AccessCodePanel';
import type { AccessCode, ActivityDay, Branch, Shift } from '../types';
import { codeVisibilityFor } from '../utils/eligibility';
import { datesInMonth, toMonthKey } from '../utils/dates';

const MONTH = toMonthKey(new Date());
const ME = 'member-me';

const branch: Branch = {
  id: 'tel-aviv',
  name: 'הסלון בתל אביב',
  city: 'תל אביב',
  timezone: 'Asia/Jerusalem',
  openingHours: {
    0: { open: '10:00', close: '22:00' },
    1: { open: '10:00', close: '22:00' },
    2: { open: '10:00', close: '22:00' },
    3: { open: '10:00', close: '22:00' },
    4: { open: '10:00', close: '22:00' },
    5: null,
    6: null,
  },
  shiftTemplates: [
    { id: 'morning', label: 'משמרת בוקר', startTime: '10:00', endTime: '14:00', weekdays: [0, 1, 2, 3, 4], isActive: true },
    { id: 'evening', label: 'משמרת ערב', startTime: '18:00', endTime: '22:00', weekdays: [0, 1, 2, 3, 4], isActive: true },
  ],
  spaces: [
    { id: 'large', name: 'חלל גדול', isActive: true, order: 1 },
    { id: 'quiet', name: 'חלל שקט', isActive: true, order: 2 },
  ],
  isActive: true,
  icsToken: 'preview',
};

const NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'];
const dates = datesInMonth(MONTH, [0, 1, 2, 3, 4]);

const shifts: Shift[] = [];
dates.forEach((date, index) => {
  for (const template of branch.shiftTemplates) {
    const slot = index * 2 + (template.id === 'evening' ? 1 : 0);
    // חצי מהמשמרות פתוחות, כפי שנמדד בגיליון 2026.
    const open = slot % 2 === 0;
    const mine = slot % 7 === 1;
    const handover = slot % 11 === 3;
    shifts.push({
      id: `${date}_${template.id}`,
      branchId: branch.id,
      date,
      templateId: template.id,
      startTime: template.startTime,
      endTime: template.endTime,
      assigneeMemberId: open ? undefined : mine ? ME : `member-${slot % 5}`,
      assigneeName: open ? undefined : mine ? 'אני' : NAMES[slot % 5],
      attendance: 'assumed',
      handoverState: handover && !open ? 'requested' : 'none',
    });
  }
});

const activityDays: ActivityDay[] = [
  {
    id: dates[2], branchId: branch.id, date: dates[2],
    events: [{ title: 'חברות לשינוי', spaceId: 'large', startTime: '19:30', endTime: '22:00' }],
    publicAccess: 'open', memberAccess: 'open',
  },
  {
    id: dates[6], branchId: branch.id, date: dates[6],
    events: [{ title: 'סדנאת קשב וריכוז', spaceId: 'quiet', startTime: '19:00', endTime: '21:30' }],
    publicAccess: 'closesEarly', memberAccess: 'open', closesAt: '18:00',
  },
  {
    id: dates[9], branchId: branch.id, date: dates[9],
    events: [], publicAccess: 'closed', memberAccess: 'closed', note: 'חג',
  },
  {
    id: dates[12], branchId: branch.id, date: dates[12],
    events: [{ title: 'עשרים ומשהו', spaceId: 'large', startTime: '20:00', endTime: '22:30' }],
    publicAccess: 'closed', memberAccess: 'open',
  },
];

const codes: AccessCode[] = [
  { id: '1', branchId: branch.id, code: '4821', validFrom: Date.now() - 86400000, periodMonth: MONTH, setBy: 'manager', setAt: Date.now() },
];

export function BoardPreview() {
  const shiftsByDate = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const list = shiftsByDate.get(shift.date) ?? [];
    list.push(shift);
    shiftsByDate.set(shift.date, list);
  }
  const activityByDate = new Map(activityDays.map((day) => [day.date, day]));
  const visibility = codeVisibilityFor(shifts, codes, ME);
  const noop = async () => {};

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <AccessCodePanel visibility={visibility} />
      <section className="rounded-xl border border-line bg-surface p-2">
        <div className="md:hidden">
          <DayList
            branch={branch}
            dates={dates}
            namedDays={new Map()}
            shiftsByDate={shiftsByDate}
            activityByDate={activityByDate}
            memberId={ME}
            canAct
            onClaim={noop}
            onRelease={noop}
            onRequestHandover={noop}
            onCancelHandover={noop}
          />
        </div>
        <div className="hidden md:block">
        <MonthBoard
          branch={branch}
          monthKey={MONTH}
        namedDays={new Map()}
          shiftsByDate={shiftsByDate}
          activityByDate={activityByDate}
          memberId={ME}
          canAct
          onClaim={noop}
          onRelease={noop}
          onRequestHandover={noop}
          onCancelHandover={noop}
        />
        </div>
      </section>
    </div>
  );
}
