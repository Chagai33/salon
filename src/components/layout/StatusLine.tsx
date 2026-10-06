// src/components/layout/StatusLine.tsx
//
// מה שצריך לדעת בשלוש שניות, בשורה אחת.
//
// ⚠️ ואפס אינו מוצג. "0 בקשות מחליף" הוא כרטיס שתופס מקום ואומר שאין מה
// לראות, וזה בדיוק מה שהפך את המסך הקודם לריק.
//
// ⚠️ וסטטוס אינו נושא בצבע לבד. כל צ'יפ כאן נושא מילה.
// DOCS/PLANING/03-the-design-standard.md

interface Item {
  key: string;
  label: string;
  tone?: 'plain' | 'attention' | 'good';
}

const TONES: Record<NonNullable<Item['tone']>, string> = {
  plain: 'bg-surface text-ink-soft ring-line',
  attention: 'bg-shift-open text-shift-open-ink ring-shift-open-line',
  good: 'bg-shift-mine text-shift-mine-ink ring-shift-mine-line',
};

export function StatusLine({ items }: { items: Item[] }) {
  const shown = items.filter(Boolean);
  if (shown.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {shown.map((item) => (
        <li
          key={item.key}
          className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${TONES[item.tone ?? "plain"]}`}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export type { Item as StatusItem };
