// src/components/common/StatusPill.tsx
//
// ⚠️ סטטוס אינו נושא בצבע לבד. התגית הזו תמיד נושאת מילה.
// זו דרישת נגישות, וגם דרישת הדפסה: הגיליון נכשל בה, כי יום פעילות שם מסומן
// בצבע התא, ומי שמדפיס בשחור לבן מאבד אותו.

export type PillTone = 'open' | 'mine' | 'taken' | 'handover' | 'closed' | 'membersOnly' | 'activity';

const TONES: Record<PillTone, string> = {
  open: 'bg-shift-open text-shift-open-ink ring-shift-open-line',
  mine: 'bg-shift-mine text-shift-mine-ink ring-shift-mine-line',
  taken: 'bg-shift-taken text-shift-taken-ink ring-shift-taken-line',
  handover: 'bg-shift-handover text-shift-handover-ink ring-shift-handover-line',
  closed: 'bg-closed text-closed-ink ring-line',
  membersOnly: 'bg-members-only text-members-only-ink ring-line',
  activity: 'bg-activity-soft text-activity ring-line',
};

interface Props {
  tone: PillTone;
  children: React.ReactNode;
}

export function StatusPill({ tone, children }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
