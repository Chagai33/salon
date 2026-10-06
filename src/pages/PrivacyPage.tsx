// src/pages/PrivacyPage.tsx
//
// ⚠️ עמוד ולא כרטיס בתוך הלוח.
//
// קודם זה היה אזור מקופל בתחתית מסך העבודה, בשם "מה שמור עליך". בעל המוצר
// הכריע שזה יהיה פוטר מינימליסטי עם מדיניות פרטיות, וזה נכון: הודעה בנקודת
// האיסוף שייכת למסך ההצטרפות, ומדיניות שייכת לכתובת שאפשר לחזור אליה.
//
// ⚠️ וזו אינה מדיניות משפטית שנוסחה על ידי עורך דין. זה תיאור נכון של מה
// שהמערכת עושה בפועל, בשפה של בני אדם.

import { Link } from 'react-router-dom';
import { t } from '../i18n/dictionary';

function Section({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <ul className="mt-1.5 flex flex-col gap-1 text-sm text-ink-soft">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true" className="text-ink-faint">
              ·
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <article className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 shadow-soft">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t.privacy.title}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t.privacy.lead}</p>
        </div>

        <Section title={t.privacy.storedTitle} lines={[t.privacy.stored]} />
        <Section title={t.privacy.whoTitle} lines={[t.privacy.whoSees, t.privacy.managersSee]} />
        <Section title={t.privacy.notTitle} lines={[t.privacy.notStored, t.privacy.calendar]} />
        <Section title={t.privacy.rightsTitle} lines={[t.privacy.rights]} />
        <Section
          title={t.privacy.managerTitle}
          lines={[
            t.privacy.managerSees,
            t.privacy.managerDoes,
            t.privacy.managerImport,
            t.privacy.managerDuty,
          ]}
        />

        <Link to="/" className="text-sm text-brand underline-offset-4 hover:underline">
          {t.privacy.back}
        </Link>
      </article>
    </div>
  );
}
