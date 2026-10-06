// src/components/board/Legend.tsx
//
// מה כל צבע בלוח אומר.
//
// ⚠️ ואינו קישוט: הוא קיים בדיוק כי צבע אינו הסימן היחיד למצב. כל משמרת
// בלוח נושאת מילה, והמקרא הוא מה שמסביר למי שרואה את הלוח בפעם הראשונה.
// DOCS/PLANING/03-the-design-standard.md

import { StatusPill } from '../common/StatusPill';
import type { PillTone } from '../common/StatusPill';
import { t } from '../../i18n/dictionary';

const ITEMS: { tone: PillTone; label: string }[] = [
  { tone: 'open', label: t.shift.open },
  { tone: 'mine', label: t.shift.mine },
  { tone: 'taken', label: t.shift.taken },
  { tone: 'handover', label: t.shift.handoverRequested },
];

export function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
      {ITEMS.map((item) => (
        <li key={item.tone}>
          <StatusPill tone={item.tone}>{item.label}</StatusPill>
        </li>
      ))}
    </ul>
  );
}
