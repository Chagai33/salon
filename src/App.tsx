// src/App.tsx
//
// ⚠️ הניווט הוא לפי סלון. הכתובת `/s/tel-aviv` היא מה שאפשר לשלוח למישהו,
// והיא גם מה שקובע מאיזה טננט נקרא. DOCS/PLANING/18-each-salon-is-a-tenant.md

import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useParams,
} from 'react-router-dom';
import { useStore } from './store/useStore';
import {
  useAuthBinding,
  useBranchesBinding,
  useCurrentBranchBinding,
  useMonthBinding,
  signInWithGoogle,
  signOutOfSalon,
} from './hooks/useSalon';
import { BoardPage } from './pages/BoardPage';
import { SalonsPage } from './pages/SalonsPage';
import { joinBranch } from './services/salonService';
import { toReadableError } from './utils/errors';
import { t } from './i18n/dictionary';
import { Footer } from './components/layout/Footer';
import { PrivacyPage } from './pages/PrivacyPage';
import { applyTheme, storedTheme } from './utils/theme';
import type { Theme } from './utils/theme';

function SignIn() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t.auth.signInTitle}</h1>
        <p className="mt-2 text-ink-soft">{t.auth.signInWho}</p>
        <p className="mt-1 text-ink-soft">{t.auth.signInBody}</p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setFailed(false);
          void signInWithGoogle()
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
        className="rounded-lg bg-brand px-5 py-3 font-medium text-brand-ink disabled:opacity-50"
      >
        {busy ? t.auth.signingIn : t.auth.signInWithGoogle}
      </button>

      {failed && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{t.auth.failed}</p>
      )}
    </main>
  );
}

function Pending() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="text-xl font-semibold text-ink">{t.pending.title}</h1>
      <p className="text-ink-soft">{t.pending.body}</p>
      <p className="text-sm text-ink-faint">{t.pending.whoToAsk}</p>
    </main>
  );
}

/** סלון שאני לא חבר בו. ⚠️ ההצטרפות היא פעולה, ואינה קורית מעצם הכניסה למסך. */
function JoinBranch({ branchId }: { branchId: string }) {
  const user = useStore((state) => state.user);
  const branch = useStore((state) => state.branch);
  const setError = useStore((state) => state.setError);
  const [busy, setBusy] = useState(false);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="text-xl font-semibold text-ink">{t.salons.joinTitle}</h1>
      <p className="text-ink-soft">{t.salons.joinBody(branch?.name ?? branchId)}</p>

      {/* ⚠️ זו נקודת האיסוף, ולכן הקישור כאן ולא רק בפוטר. מי שמבקש להצטרף
          רואה לפני שהוא לוחץ מה נשמר עליו ומי רואה את זה. */}
      <Link to="/privacy" className="text-sm text-brand underline-offset-4 hover:underline">
        {t.footer.privacy}
      </Link>

      <div>
        <button
          type="button"
          disabled={busy || !user}
          onClick={() => {
            setBusy(true);
            setError(null);
            void joinBranch(user!, branchId)
              .catch((error: unknown) => setError(toReadableError(error, t.errors.saveFailed)))
              .finally(() => setBusy(false));
          }}
          className="rounded-md bg-brand px-4 py-2 font-medium text-brand-ink disabled:opacity-50"
        >
          {busy ? t.salons.joining : t.salons.join}
        </button>
      </div>
    </main>
  );
}

/**
 * ⚠️ הקישור הראשון בעמוד, ונראה רק במיקוד. מי שמנווט במקלדת אינו צריך לעבור
 * על כל הכותרת בכל טעינה.
 *
 * ⚠️ ו-`start-2` ולא `left-2`. ב-RTL הקישור היה קופץ לצד הלא נכון, וזה בדיוק
 * מה שהסקיל מונה כתקלה הנפוצה בקישור דילוג.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="absolute start-2 z-50 -translate-y-20 rounded-card bg-brand px-4 py-2 text-sm font-medium text-brand-ink focus:translate-y-2"
    >
      {t.a11yNav.skipToMain}
    </a>
  );
}

/** בהיר וכהה, בבחירה. ⚠️ ולא לפי מערכת ההפעלה. src/utils/theme.ts */
function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme());

  return (
    <button
      type="button"
      onClick={() => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={theme === 'dark' ? t.theme.toLight : t.theme.toDark}
      title={theme === 'dark' ? t.theme.toLight : t.theme.toDark}
      className="grid size-9 place-items-center rounded-card border border-line text-ink-soft hover:bg-brand-soft hover:text-ink"
    >
      {/* ⚠️ שמש וסהר אינם אייקונים כיווניים ולכן אינם מתהפכים ב-RTL.
          aria-hidden, והשם הנגיש יושב על הכפתור עצמו. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        {theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
          </>
        ) : (
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}

/** ⚠️ מיוצא כדי שאפשר יהיה לרנדר את המסך בבדיקה בלי המאזינים. */
export function TopBar() {
  const user = useStore((state) => state.user);
  const member = useStore((state) => state.member);
  const branch = useStore((state) => state.branch);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-3">
        {/*
          ⚠️ שם הסלון אינו כאן, ובכוונה. הוא הופיע גם בכותרת העליונה וגם בכותרת
          העמוד, ושתי הפעמים אותה מחרוזת. הוא נשאר במקום אחד, ליד החודש.

          ⚠️ ו-`/salons` ולא `/`: זה היה הבאג, כי `/` נכנס אוטומטית לסלון
          היחיד ולכן הקישור חזר מיד לאותו מסך.
        */}
        <div className="flex items-center gap-3">
          <Link to="/" className="font-semibold text-ink hover:underline">
            {t.appName}
          </Link>
          {branch && (
            <Link
              to="/salons"
              className="text-sm text-ink-soft underline-offset-4 hover:underline"
            >
              {t.salons.switch}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <ThemeToggle />
          <span className="text-ink-soft">{member?.displayName ?? user?.displayName}</span>
          <button
            type="button"
            onClick={() => void signOutOfSalon()}
            className="rounded-md border border-line-strong px-3 py-1.5 hover:bg-brand-soft"
          >
            {t.auth.signOut}
          </button>
        </div>
      </div>
    </header>
  );
}

export function ErrorBar() {
  const error = useStore((state) => state.error);
  if (!error) return null;
  return (
    <p
      role="alert"
      className="mx-auto max-w-6xl rounded-md bg-danger-soft px-4 py-2 text-sm text-danger"
    >
      {error}
    </p>
  );
}

/** הסלון שבכתובת. כל מה שנקרא מהמסד כאן שייך לו בלבד. */
function BranchScope() {
  const { branchId = '' } = useParams();
  const setBranchId = useStore((state) => state.setBranchId);
  const branch = useStore((state) => state.branch);
  const member = useStore((state) => state.member);
  const branches = useStore((state) => state.branches);
  const areBranchesLoading = useStore((state) => state.areBranchesLoading);
  const canOpenBranch = useStore((state) => state.canOpenBranch);

  useEffect(() => {
    setBranchId(branchId);
  }, [branchId, setBranchId]);

  useCurrentBranchBinding(branchId);
  useMonthBinding(branchId);

  const exists = branches.some((candidate) => candidate.id === branchId);

  if (!areBranchesLoading && !exists) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <p className="text-ink-soft">{t.salons.notFound}</p>
        <Link to="/" className="text-brand underline-offset-2 hover:underline">
          {t.salons.backToList}
        </Link>
      </main>
    );
  }

  if (!branch) return <main className="p-6 text-ink-soft">{t.board.loading}</main>;
  if (!member) return <JoinBranch branchId={branchId} />;
  // ⚠️ ומנהל העל אינו ממתין לאישור. בסלון שנוצר לפני שהוא תבע את המערכת אין
  // מנהלת שתאשר אותו, ולכן מסך ההמתנה היה מסך ללא יציאה.
  if (member.status === 'pending' && !canOpenBranch) return <Pending />;
  return <BoardPage branchId={branchId} />;
}

/** ⚠️ סלון יחיד נכנסים אליו ישר. רשימה של אחד אינה בחירה. */
function Home() {
  const memberships = useStore((state) => state.myMemberships);
  const branchesLoading = useStore((state) => state.areBranchesLoading);
  const membershipsLoading = useStore((state) => state.areMembershipsLoading);

  // ⚠️ ממתין גם לחברויות. בלי זה מי שחבר בסלון אחד רואה לרגע את מסך הבחירה
  // ואז נזרק ממנו, וזה נקרא כמו תקלה.
  if (branchesLoading || membershipsLoading) {
    return <main className="p-6 text-ink-soft">{t.salons.loading}</main>;
  }

  const ids = Object.keys(memberships);
  if (ids.length === 1) return <Navigate to={`/s/${ids[0]}`} replace />;
  return <SalonsPage />;
}

function SignedIn() {
  useBranchesBinding();
  return <Shell />;
}

/** ⚠️ בלי המאזינים, כדי שאפשר יהיה לרנדר את עץ המסכים בבדיקה. */
export function Shell() {
  return (
    <div className="min-h-screen">
      <SkipLink />
      <TopBar />
      <ErrorBar />
      <Routes>
        <Route path="/" element={<Home />} />
        {/* ⚠️ הרשימה המפורשת, ואינה מפנה לשום מקום. */}
        <Route path="/salons" element={<SalonsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/s/:branchId" element={<BranchScope />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default function App() {
  useAuthBinding();

  const user = useStore((state) => state.user);
  const isAuthResolved = useStore((state) => state.isAuthResolved);

  if (!isAuthResolved) {
    return <main className="p-6 text-ink-soft">{t.board.loading}</main>;
  }

  if (!user) return <SignIn />;

  return (
    <BrowserRouter>
      <SignedIn />
    </BrowserRouter>
  );
}
