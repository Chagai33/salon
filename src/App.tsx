import { useStore } from './store/useStore';
import { useAuthBinding, useBranchBinding, useMonthBinding, signInWithGoogle, signOutOfSalon } from './hooks/useSalon';
import { BoardPage } from './pages/BoardPage';
import { t } from './i18n/dictionary';
import { useState } from 'react';

function SignIn() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t.auth.signInTitle}</h1>
        <p className="mt-3 text-ink-soft">{t.auth.signInBody}</p>
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

function TopBar() {
  const user = useStore((state) => state.user);
  const member = useStore((state) => state.member);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 p-3">
        <span className="font-semibold text-ink">{t.appName}</span>
        <div className="flex items-center gap-3 text-sm">
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

export default function App() {
  useAuthBinding();
  useBranchBinding();
  useMonthBinding();

  const user = useStore((state) => state.user);
  const member = useStore((state) => state.member);
  const isAuthResolved = useStore((state) => state.isAuthResolved);
  const error = useStore((state) => state.error);

  if (!isAuthResolved) {
    return <main className="p-6 text-ink-soft">{t.board.loading}</main>;
  }

  if (!user) return <SignIn />;

  return (
    <div className="min-h-screen">
      <TopBar />
      {error && (
        <p
          role="alert"
          className="mx-auto max-w-6xl rounded-md bg-danger-soft px-4 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {member?.status === 'pending' ? <Pending /> : <BoardPage />}
    </div>
  );
}
