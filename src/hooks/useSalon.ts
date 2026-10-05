// src/hooks/useSalon.ts
//
// מחבר את המאזינים ל-Store. רכיב אינו פותח מאזין בעצמו.

import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useStore } from '../store/useStore';
import {
  DEFAULT_BRANCH_ID,
  ensureDefaultBranch,
  ensureMember,
  watchAccessCodes,
  watchActivityDaysForMonth,
  watchBranch,
  watchMember,
  watchMembers,
  watchShiftsForMonth,
} from '../services/salonService';
import { t } from '../i18n/dictionary';

export function useAuthBinding() {
  const setUser = useStore((state) => state.setUser);
  const setMember = useStore((state) => state.setMember);
  const setAuthResolved = useStore((state) => state.setAuthResolved);
  const setError = useStore((state) => state.setError);
  const reset = useStore((state) => state.reset);

  useEffect(() => {
    let stopMember: (() => void) | undefined;

    const stopAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      stopMember?.();
      stopMember = undefined;

      if (!firebaseUser) {
        reset();
        setAuthResolved(true);
        return;
      }

      const user = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName ?? firebaseUser.email ?? 'חבר',
        email: firebaseUser.email ?? '',
        photoURL: firebaseUser.photoURL ?? undefined,
      };
      setUser(user);

      try {
        await ensureDefaultBranch();
        await ensureMember(user);
        stopMember = watchMember(DEFAULT_BRANCH_ID, user.uid, setMember);
      } catch (error) {
        setError(error instanceof Error ? error.message : t.errors.saveFailed);
      } finally {
        setAuthResolved(true);
      }
    });

    return () => {
      stopMember?.();
      stopAuth();
    };
  }, [reset, setAuthResolved, setError, setMember, setUser]);
}

export function useBranchBinding() {
  const user = useStore((state) => state.user);
  const setBranch = useStore((state) => state.setBranch);
  const setMembers = useStore((state) => state.setMembers);

  useEffect(() => {
    if (!user) return;
    const stopBranch = watchBranch(DEFAULT_BRANCH_ID, setBranch);
    const stopMembers = watchMembers(DEFAULT_BRANCH_ID, setMembers);
    return () => {
      stopBranch();
      stopMembers();
    };
  }, [user, setBranch, setMembers]);
}

export function useMonthBinding() {
  const user = useStore((state) => state.user);
  const monthKey = useStore((state) => state.monthKey);
  const setShifts = useStore((state) => state.setShifts);
  const setActivityDays = useStore((state) => state.setActivityDays);
  const setAccessCodes = useStore((state) => state.setAccessCodes);
  const setError = useStore((state) => state.setError);

  useEffect(() => {
    if (!user) return;
    const stops = [
      watchShiftsForMonth(DEFAULT_BRANCH_ID, monthKey, setShifts),
      watchActivityDaysForMonth(DEFAULT_BRANCH_ID, monthKey, setActivityDays),
      watchAccessCodes(DEFAULT_BRANCH_ID, setAccessCodes),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user, monthKey, setShifts, setActivityDays, setAccessCodes, setError]);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

export async function signOutOfSalon(): Promise<void> {
  await signOut(auth);
}
