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

  /*
    ⚠️ כרטיס ולא שורה ברשימה צרה.
    בעל המוצר מדד 06/10 שהמסך נראה "כאילו התצוגה היא של פלאפון" על המחשב:
    עמודה ברוחב 672 במרכז מסך רחב, ושורות דקות בתוכה. DOCS/PLANING/26
  */
  return (
    <li className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-raised">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-ink">
          <bdi>{branch.name}</bdi>
        </h3>
        {membership?.role === 'manager' && (
          <StatusPill tone="mine">{t.salons.managerHere}</StatusPill>
        )}
        {isPending && <StatusPill tone="open">{t.salons.waiting}</StatusPill>}
      </div>

      {branch.city && <p className="text-sm text-ink-soft">{branch.city}</p>}

      {/* ⚠️ הפעולה בתחתית הכרטיס, ובאותו מקום בכל כרטיס. mt-auto מיישר אותן
          גם כשלסלון אחד יש עיר ולשני אין. */}
      <div className="mt-auto pt-1">
        {membership ? (
          <Link
            to={`/s/${branch.id}`}
            className="inline-flex min-h-11 items-center rounded-card border border-line-strong px-4 text-sm font-medium text-ink hover:bg-brand-soft"
          >
            {t.salons.enter}
          </Link>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void join()}
            className="inline-flex min-h-11 items-center rounded-card bg-brand px-4 text-sm font-semibold text-brand-ink disabled:opacity-50"
          >
            {busy ? t.salons.joining : t.salons.join}
          </button>
        )}
      </div>
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
        {/* ⚠️ dir="auto" על כל שדה טקסט חופשי. בלעדיו שם באנגלית שנכתב
            בטופס עברי קופץ לצד הלא נכון בזמן ההקלדה. */}
        <input
          required
          dir="auto"
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
          dir="auto"
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
        {/*
          ⚠️ הכתובת המלאה, וכפי שהיא תיראה באמת.
          origin מהדפדפן ולא מחרוזת קשיחה, כדי שבפיתוח ובאתר החי ייכתב מה
          שבאמת יהיה. ⚠️ ובתוך dir=ltr, כי כתובת נקראת משמאל. DOCS/PLANING/26
        */}
        <span className="text-xs text-ink-faint">
          {t.salons.idExample}
          {/* ⚠️ רק הכתובת ב-num. dir=ltr על המשפט כולו היה מסדר את העברית
              שבתוכו הפוך. */}
          <span className="num ms-1 break-all">
            {window.location.origin}/s/{id.trim() || t.salons.idPlaceholder}
          </span>
        </span>
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

  // ⚠️ רשת שמתרחבת עם המסך, ולא עמודה אחת בכל רוחב.
  const grid = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5">
      {claimed === false && <ClaimSystem />}

      {mine.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink">{t.salons.mine}</h2>
          <ul className={grid}>
            {mine.map((branch) => (
              <BranchRow key={branch.id} branch={branch} membership={memberships[branch.id]} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-ink">
          {mine.length > 0 ? t.salons.others : t.salons.title}
        </h2>
        {others.length === 0 ? (
          <p className="rounded-card border border-line bg-surface px-4 py-4 text-sm text-ink-soft">
            {t.salons.none}
          </p>
        ) : (
          <ul className={grid}>
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
        <section className="max-w-xl rounded-card border border-line bg-surface">
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
              className="min-h-12 w-full px-4 text-start text-sm font-medium text-ink hover:bg-brand-soft"
            >
              {t.salons.openAction}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
