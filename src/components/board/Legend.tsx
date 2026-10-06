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
    <div className="border-t border-line px-4 py-3">
      <ul className="flex flex-wrap items-center gap-2">
        {ITEMS.map((item) => (
          <li key={item.tone}>
            <StatusPill tone={item.tone}>{item.label}</StatusPill>
          </li>
        ))}
      </ul>

      {/*
        ⚠️⚠️ ואין כאן שורה על שישי ושבת.
        בלשון בעל המוצר, 06/10: "כולם יודעים את זה ולכן מיותר לרשום את זה".
        מה שכל חבר בסלון יודע אינו נכתב על המסך. DOCS/PLANING/26
      */}
    </div>
  );
}
