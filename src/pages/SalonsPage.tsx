// src/pages/SalonsPage.tsx
//
// מסך הבחירה: באילו סלונים אני, ואילו עוד קיימים.
//
// ⚠️ הוא אינו מציג שום דבר מתוך סלון שאינני חבר בו. שם, עיר, וזהו. כל מה
// שבתוך הסלון סגור לחבריו, וזה נמדד מול אמולטור.
// DOCS/PLANING/18-each-salon-is-a-tenant.md

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { claimSystem, joinBranch, openBranch } from '../services/salonService';
import { t } from '../i18n/dictionary';
import { StatusPill } from '../components/common/StatusPill';
import { toReadableError } from '../utils/errors';
import type { Branch, Member } from '../types';

/** ⚠️ בונה מערכים, ולכן נקראת מתוך useMemo ולא כבורר. */
export function splitBranches(
  branches: Branch[],
  memberships: Record<string, Member>,
): { mine: Branch[]; others: Branch[] } {
  return {
    mine: branches.filter((branch) => memberships[branch.id]),
    others: branches.filter((branch) => !memberships[branch.id]),
  };
}

function BranchRow({ branch, membership }: { branch: Branch; membership?: Member }) {
  const user = useStore((state) => state.user);
  const setError = useStore((state) => state.setError);
  const setMyMemberships = useStore((state) => state.setMyMemberships);
  const memberships = useStore((state) => state.myMemberships);
  const [busy, setBusy] = useState(false);

  const isPending = membership?.status === 'pending';

  async function join() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const member = await joinBranch(user, branch.id);
      setMyMemberships({ ...memberships, [branch.id]: member });
    } catch (error) {
      setError(toReadableError(error, t.errors.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-3 last:border-0">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{branch.name}</span>
          {membership?.role === 'manager' && (
            <StatusPill tone="mine">{t.salons.managerHere}</StatusPill>
          )}
          {isPending && <StatusPill tone="open">{t.salons.waiting}</StatusPill>}
        </div>
        {branch.city && <p className="text-sm text-ink-soft">{branch.city}</p>}
      </div>

      {membership ? (
        <Link
          to={`/s/${branch.id}`}
          className="rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-brand-soft"
        >
          {t.salons.enter}
        </Link>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void join()}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink disabled:opacity-50"
        >
          {busy ? t.salons.joining : t.salons.join}
        </button>
      )}
    </li>
  );
}

/**
 * ⚠️ מוצג רק כשאף אחד לא תבע את המערכת, ונעלם לעולם אחרי התביעה הראשונה.
 * DOCS/PLANING/21-nobody-told-the-database-who-the-owner-is.md
 */
function ClaimSystem() {
  const user = useStore((state) => state.user);
  const setCanOpenBranch = useStore((state) => state.setCanOpenBranch);
  const setSystemClaimed = useStore((state) => state.setSystemClaimed);
  const setError = useStore((state) => state.setError);
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-xl border border-shift-open-line bg-shift-open p-3">
      <h2 className="font-semibold text-shift-open-ink">{t.salons.claimTitle}</h2>
      <p className="mt-1 text-sm text-shift-open-ink">{t.salons.claimBody}</p>
      <button
        type="button"
        disabled={busy || !user}
        onClick={() => {
          setBusy(true);
          setError(null);
          void claimSystem(user!)
            .then(() => {
              setCanOpenBranch(true);
              setSystemClaimed(true);
            })
            .catch((error: unknown) => setError(toReadableError(error, t.errors.saveFailed)))
            .finally(() => setBusy(false));
        }}
        className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-50"
      >
        {busy ? t.salons.claiming : t.salons.claimAction}
      </button>
    </section>
  );
}

function OpenBranchForm({ onDone }: { onDone: () => void }) {
  const user = useStore((state) => state.user);
  const setError = useStore((state) => state.setError);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await openBranch(user, { id: id.trim(), name: name.trim(), city: city.trim() });
      onDone();
      void navigate(`/s/${id.trim()}`);
    } catch (error) {
      setError(toReadableError(error, t.errors.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-ink';

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-3">
      <p className="text-sm text-ink-soft">{t.salons.openBody}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">{t.salons.nameLabel}</span>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.salons.namePlaceholder}
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">{t.salons.cityLabel}</span>
        <input
          required
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder={t.salons.cityPlaceholder}
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft">{t.salons.idLabel}</span>
        {/* ⚠️ dir="ltr" ו-text-start: מזהה לטיני בתוך טופס עברי נקרא הפוך בלעדיו. */}
        <input
          required
          dir="ltr"
          value={id}
          onChange={(event) => setId(event.target.value.toLowerCase())}
          placeholder={t.salons.idPlaceholder}
          className={`${field} text-start`}
        />
        <span className="text-xs text-ink-faint">{t.salons.idHint}</span>
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-50"
        >
          {busy ? t.salons.creating : t.salons.create}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-4 py-2 text-sm text-ink-soft hover:underline"
        >
          {t.salons.cancel}
        </button>
      </div>
    </form>
  );
}

export function SalonsPage() {
  const branches = useStore((state) => state.branches);
  const memberships = useStore((state) => state.myMemberships);
  const loading = useStore((state) => state.areBranchesLoading);
  const canOpen = useStore((state) => state.canOpenBranch);
  const claimed = useStore((state) => state.isSystemClaimed);
  const [opening, setOpening] = useState(false);

  const { mine, others } = useMemo(
    () => splitBranches(branches, memberships),
    [branches, memberships],
  );

  if (loading) return <p className="p-6 text-ink-soft">{t.salons.loading}</p>;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      {claimed === false && <ClaimSystem />}

      {mine.length > 0 && (
        <section className="rounded-xl border border-line bg-surface">
          <h2 className="border-b border-line p-3 text-lg font-semibold text-ink">
            {t.salons.mine}
          </h2>
          <ul>
            {mine.map((branch) => (
              <BranchRow key={branch.id} branch={branch} membership={memberships[branch.id]} />
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-line bg-surface">
        <h2 className="border-b border-line p-3 text-lg font-semibold text-ink">
          {mine.length > 0 ? t.salons.others : t.salons.title}
        </h2>
        {others.length === 0 ? (
          <p className="px-3 py-4 text-sm text-ink-soft">{t.salons.none}</p>
        ) : (
          <ul>
            {others.map((branch) => (
              <BranchRow key={branch.id} branch={branch} />
            ))}
          </ul>
        )}
      </section>

      {/* ⚠️ ולא לכולם. פתיחת סלון פתוחה למי שמפעיל את המערכת, ולא לכל מי
          שנכנס ב-Google. החוקים אוכפים את זה, וזו רק ההסתרה בממשק.
          DOCS/PLANING/20-who-may-open-a-salon.md */}
      {canOpen && (
      <section className="rounded-xl border border-line bg-surface">
        {opening ? (
          <>
            <h2 className="border-b border-line p-3 text-lg font-semibold text-ink">
              {t.salons.openTitle}
            </h2>
            <OpenBranchForm onDone={() => setOpening(false)} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpening(true)}
            className="w-full px-3 py-3 text-start text-sm font-medium text-ink hover:bg-brand-soft"
          >
            {t.salons.openAction}
          </button>
        )}
      </section>
      )}
    </div>
  );
}
