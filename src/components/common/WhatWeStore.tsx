// src/components/common/WhatWeStore.tsx
//
// מה המערכת יודעת על החבר, ומי רואה את זה.
//
// ⚠️⚠️ וזו אינה מדיניות פרטיות משפטית. זו הודעה בנקודת האיסוף: מה נאסף,
// למה, ומי רואה אותו. העיקרון של בעל המוצר: שקיפות ובהירות למשתמש.
//
// ⚠️ והשורה על המייל היא ממצא ולא ניסוח. בהכרעת בעל המוצר "חבר רואה את
// כולם", ומסך החברים מציג מייל. כלומר המייל של כל חבר גלוי לכל חבר אחר,
// ועד כה שום מסך לא אמר לו את זה.

import { t } from '../../i18n/dictionary';

const LINES = [
  t.privacy.stored,
  t.privacy.whoSees,
  t.privacy.managersSee,
  t.privacy.calendar,
  t.privacy.notStored,
];

/**
 * @param open האם פתוח כברירת מחדל. במסך ההצטרפות כן, כי שם זו נקודת האיסוף.
 *             בתוך האפליקציה לא, כי שם זה מידע שחוזרים אליו.
 */
export function WhatWeStore({ open = false }: { open?: boolean }) {
  return (
    <details open={open} className="rounded-card border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-soft hover:text-ink">
        {t.privacy.title}
      </summary>
      <ul className="flex flex-col gap-1.5 px-4 pb-4 text-sm text-ink-soft">
        {LINES.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
