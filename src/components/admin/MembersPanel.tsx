// src/components/admin/MembersPanel.tsx
//
// מי ביקש להיכנס, ומי כבר בפנים. למנהלת בלבד.
//
// ⚠️ המייל מוצג ואינו מוסתר, וזו החלטה ולא ברירת מחדל. השם שמגיע מ-Google הוא
// מה שאדם כתב לעצמו בפרופיל, ולפעמים הוא שם של עסק. המנהלת מאשרת אדם, והיא
// צריכה לדעת מי הוא לפני שהיא מאשרת. CLAUDE.md, אזור ליבה 3.
//
// ⚠️ והמייל נושא dir="ltr". בלעדיו כתובת באמצע עברית נקראת הפוך.

import { useMemo, useState } from 'react';
import { splitMembers, useStore } from '../../store/useStore';
import { approveMember, setMemberRole } from '../../services/salonService';
import { t } from '../../i18n/dictionary';
import { StatusPill } from '../common/StatusPill';
import { toReadableError } from '../../utils/errors';
import { shortDateLabel, toDateKey } from '../../utils/dates';
import type { Member } from '../../types';
// ⚠️ שם מלא כאן, ולא מקוצר. זה המסך שבו מזהים אדם לפני שמאשרים אותו.
import { fullName } from '../../utils/names';

function joinedLabel(joinedAt: number | undefined): string {
  if (!joinedAt) return '';
  return shortDateLabel(toDateKey(new Date(joinedAt)));
}

/** ⚠️ ראשי תיבות ולא תמונה. תמונת פרופיל אינה נשמרת במסד, וראשי תיבות
 *  נותנים את אותה עזרה בזיהוי בלי להוסיף שדה. */
function Initials({ name }: { name: string }) {
  const letters = fullName(name)
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');

  return (
    <span
      aria-hidden="true"
      className="grid size-8 flex-none place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand"
    >
      {letters}
    </span>
  );
}

function Email({ address }: { address: string }) {
  // ⚠️ `dir="ltr"` ו-inline-block. מספר או כתובת בתוך עברית נושאים כיוון משלהם.
  return (
    <span dir="ltr" className="inline-block text-ink-soft">
      {address}
    </span>
  );
}

export function MembersPanel({ branchId }: { branchId: string }) {
  const members = useStore((state) => state.members);
  const me = useStore((state) => state.member);
  const canOpenBranch = useStore((state) => state.canOpenBranch);
  const setError = useStore((state) => state.setError);

  // ⚠️ ב-useMemo ולא בבורר. בורר שמסנן מערך מחזיר מערך חדש בכל קריאה, וזו
  // הלולאה שהפילה את המסך. DOCS/PLANING/16-the-selector-that-looped.md
  const { pending, approved } = useMemo(() => splitMembers(members), [members]);

  const [busyId, setBusyId] = useState<string | null>(null);

  async function run(memberId: string, action: () => Promise<void>) {
    setBusyId(memberId);
    setError(null);
    try {
      await action();
    } catch (error) {
      setError(toReadableError(error, t.errors.saveFailed));
    } finally {
      setBusyId(null);
    }
  }

  function rowActions(member: Member) {
    const busy = busyId === member.id;
    const isMe = member.id === me?.id;

    if (member.status === 'pending') {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(member.id, () =>
              approveMember(branchId, member.id, me!.id),
            )
          }
          className="inline-flex min-h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-ink disabled:opacity-50"
        >
          {busy ? t.manager.approving : t.manager.approve}
        </button>
      );
    }

    // ⚠️ מנהל העל מגדיר את עצמו כמנהלת בסלון שנוצר לפניו. בלי זה אין בסלון
    // הזה אף אחד שיכול, והתיקון חוזר לקונסולה.
    if (isMe && canOpenBranch && member.role !== 'manager') {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(member.id, () => setMemberRole(branchId, member.id, 'manager'))}
          className="inline-flex min-h-9 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-brand-ink disabled:opacity-50"
        >
          {busy ? t.manager.working : t.manager.promoteMe}
        </button>
      );
    }

    // ⚠️ ומנהלת אינה מסירה את עצמה מניהול. אם תעשה זאת כשהיא היחידה, אין יותר
    // מי שיאשר אף אחד, והתיקון חוזר לקונסולה.
    if (isMe) return <span className="text-sm text-ink-faint">{t.manager.me}</span>;

    const nextRole = member.role === 'manager' ? 'member' : 'manager';
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void run(member.id, () => setMemberRole(branchId, member.id, nextRole))
        }
        className="rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-brand-soft disabled:opacity-50"
      >
        {busy
          ? t.manager.working
          : member.role === 'manager'
            ? t.manager.unmakeManager
            : t.manager.makeManager}
      </button>
    );
  }

  function table(rows: Member[], emptyText: string, caption: string) {
    if (rows.length === 0) {
      return <p className="px-4 pb-4 text-sm text-ink-soft">{emptyText}</p>;
    }

    return (
      <table className="w-full text-start text-sm">
        {/* ⚠️ כתובית לקורא מסך. טבלה בלי כתובית נקראת בלי הקשר. */}
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-ink-faint">
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t.manager.nameColumn}
            </th>
            <th scope="col" className="hidden px-4 py-2 text-start font-medium sm:table-cell">
              {t.manager.emailColumn}
            </th>
            <th scope="col" className="hidden px-4 py-2 text-start font-medium lg:table-cell">
              {t.manager.joinedColumn}
            </th>
            <th scope="col" className="px-4 py-2 text-start font-medium">
              {t.manager.actionColumn}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr key={member.id} className="border-t border-line">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Initials name={member.displayName} />
                  <bdi className="font-medium text-ink">{fullName(member.displayName)}</bdi>
                  {member.role === 'manager' && (
                    <StatusPill tone="mine">{t.manager.roleManager}</StatusPill>
                  )}
                </div>
                {/* ⚠️ המייל חוזר כאן ברוחב טלפון, כי עמודת המייל מוסתרת שם. */}
                <div className="ps-10.5 sm:hidden">
                  <Email address={member.email} />
                </div>
              </td>
              <td className="hidden px-4 py-2.5 sm:table-cell">
                <Email address={member.email} />
              </td>
              <td className="hidden px-4 py-2.5 text-ink-soft lg:table-cell">
                {joinedLabel(member.joinedAt)}
              </td>
              <td className="px-4 py-2.5">{rowActions(member)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface shadow-soft">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 pt-4">
        <h2 className="text-base font-semibold text-ink">{t.manager.members}</h2>
        <span className="text-sm text-ink-soft">
          {t.manager.summary(approved.length, pending.length)}
        </span>
      </header>

      {/*
        ⚠️ הממתינים אינם מקופלים, גם כשרשימת כל החברים כן. מי שממתין הוא מה
        שדורש פעולה עכשיו, ובקשה שמסתתרת מאחורי מתג היא בקשה שלא מטופלת.
      */}
      {pending.length > 0 && (
        <div className="mt-3">
          <h3 className="px-4 text-xs font-semibold uppercase tracking-wide text-shift-open-ink">
            {t.manager.pendingApproval}
          </h3>
          {table(pending, t.manager.noPending, t.manager.pendingApproval)}
        </div>
      )}

      {/* ⚠️ והרשימה המלאה מקופלת. היא מה שמסתכלים בו כשמחפשים מישהו, ולא מה
          שצריך לראות בכל פתיחה של המסך. כל הפעולות נשארות בתוכה. */}
      <details className="group mt-2">
        <summary className="cursor-pointer px-4 py-3 text-sm text-ink-soft hover:text-ink">
          {t.manager.showAll}
        </summary>
        {table(approved, t.manager.noMembers, t.manager.approvedMembers)}
      </details>
    </section>
  );
}
