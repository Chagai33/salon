// src/pages/TermsPage.tsx
//
// ⚠️⚠️ העמוד הזה קיים בשביל משפט אחד, ובלשון בעל המוצר:
// "אני לא יוצאים לשינוי וזה לא אתר רשמי."
//
// ⚠️ ומי שרואה לוח משמרות של הסלון מניח שהעמותה עומדת מאחוריו. היא אינה,
// וזה צריך להיות כתוב במקום שאפשר להגיע אליו.

import { Link } from 'react-router-dom';
import { t } from '../i18n/dictionary';
import { buildDate, version } from 'virtual:app-version';

function Block({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">{body}</p>
    </section>
  );
}

/** `2026-10-06` ל-`06.10.2026`. ⚠️ נקודות ולא לוכסנים, כמקובל בעברית. */
function hebrewDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

export function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <article className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 shadow-soft">
        <h1 className="text-xl font-semibold text-ink">{t.terms.title}</h1>

        {/* ⚠️ ראשון, ובהדגשה. זו ההסתייגות ולא הערת שוליים. */}
        <div className="rounded-card bg-shift-open p-4">
          <h2 className="text-sm font-semibold text-shift-open-ink">
            {t.terms.notOfficialTitle}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-shift-open-ink">
            {t.terms.notOfficial}
          </p>
        </div>

        <Block title={t.terms.whatItIsTitle} body={t.terms.whatItIs} />
        <Block title={t.terms.sourceTitle} body={t.terms.source} />
        <Block title={t.terms.codeTitle} body={t.terms.code} />
        <Block title={t.terms.noWarrantyTitle} body={t.terms.noWarranty} />

        <Link to="/" className="text-sm text-brand underline-offset-4 hover:underline">
          {t.terms.back}
        </Link>

        {/*
          ⚠️ הגרסה, בהכרעת בעל המוצר 06/10: "אני מעדיף שאת הגרסה תכניס בתוך
          תנאי השימוש". בפוטר היא הייתה שורה שלישית ליד שני קישורים, וכאן היא
          מה שהיא: פרט על המסמך הזה. DOCS/PLANING/26
          ⚠️ והמספרים ב-num, כי מספר בתוך עברית מסתדר הפוך בלעדיו.
        */}
        <p className="border-t border-line pt-4 text-xs text-ink-faint">
          {t.terms.version}
          <span className="num ms-1">{version}</span>
          <span className="mx-1">·</span>
          {t.terms.builtOn}
          <span className="num ms-1">{hebrewDate(buildDate)}</span>
        </p>
      </article>
    </div>
  );
}
