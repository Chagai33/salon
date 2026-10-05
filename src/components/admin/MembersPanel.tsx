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

function joinedLabel(joinedAt: number | undefined): string {
  if (!joinedAt) return '';
  return shortDateLabel(toDateKey(new Date(joinedAt)));
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
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink disabled:opacity-50"
        >
          {busy ? t.manager.approving : t.manager.approve}
        </button>
      );
    }

    // ⚠️ מנהלת אינה מסירה את עצמה מניהול. אם תעשה זאת כשהיא היחידה, אין יותר
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

  function table(rows: Member[], emptyText: string) {
    if (rows.length === 0) {
      return <p className="px-3 py-4 text-sm text-ink-soft">{emptyText}</p>;
    }

    return (
      <table className="w-full text-start text-sm">
        <thead>
          <tr className="border-b border-line text-ink-faint">
            <th scope="col" className="px-3 py-2 text-start font-medium">
              {t.manager.nameColumn}
            </th>
            <th scope="col" className="px-3 py-2 text-start font-medium">
              {t.manager.emailColumn}
            </th>
            <th scope="col" className="hidden px-3 py-2 text-start font-medium sm:table-cell">
              {t.manager.joinedColumn}
            </th>
            <th scope="col" className="px-3 py-2 text-start font-medium">
              {t.manager.actionColumn}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((member) => (
            <tr key={member.id} className="border-b border-line last:border-0">
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{member.displayName}</span>
                  {member.role === 'manager' && (
                    <StatusPill tone="mine">{t.manager.roleManager}</StatusPill>
                  )}
                </div>
                {/* ⚠️ המייל חוזר כאן ברוחב טלפון, כי עמודת המייל מוסתרת שם. */}
                <div className="sm:hidden">
                  <Email address={member.email} />
                </div>
              </td>
              <td className="hidden px-3 py-2 sm:table-cell">
                <Email address={member.email} />
              </td>
              <td className="hidden px-3 py-2 text-ink-soft sm:table-cell">
                {joinedLabel(member.joinedAt)}
              </td>
              <td className="px-3 py-2">{rowActions(member)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
        <h2 className="text-lg font-semibold text-ink">{t.manager.members}</h2>
        {pending.length > 0 && (
          <span className="text-sm text-shift-open-ink">
            {t.manager.waitingToApprove(pending.length)}
          </span>
        )}
      </header>

      <div className="border-b border-line">
        <h3 className="px-3 pt-3 text-sm font-medium text-ink-soft">
          {t.manager.pendingApproval}
        </h3>
        {table(pending, t.manager.noPending)}
      </div>

      {/*
        ⚠️ הרשימה המאושרת מקופלת, והממתינים אינם. מי שממתין הוא מה שדורש פעולה
        עכשיו, ורשימת כל החברים היא מה שמסתכלים בו כשמחפשים משהו.
      */}
      <details>
        <summary className="cursor-pointer px-3 py-3 text-sm font-medium text-ink-soft">
          {t.manager.approvedMembers} ({approved.length})
        </summary>
        {table(approved, t.manager.noMembers)}
      </details>
    </section>
  );
}
