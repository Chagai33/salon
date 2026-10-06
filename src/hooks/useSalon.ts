// src/hooks/useSalon.ts
//
// מחבר את המאזינים ל-Store. רכיב אינו פותח מאזין בעצמו.
//
// ⚠️ ושלוש שכבות ולא אחת: מי אני, אילו סלונים יש, ומה יש בסלון שאני בו.
// כל שכבה ממתינה לקודמת, כי קריאה לתוך סלון דורשת רשומת חבר בו.

import { useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useStore } from '../store/useStore';
import {
  isPlatformAdmin,
  isSystemClaimed,
  myMemberships,
  watchAccessCodes,
  watchActivityDaysForMonth,
  watchBranch,
  watchBranches,
  watchMember,
  watchMembers,
  watchShiftsForMonth,
} from '../services/salonService';

export function useAuthBinding() {
  const setUser = useStore((state) => state.setUser);
  const setAuthResolved = useStore((state) => state.setAuthResolved);
  const reset = useStore((state) => state.reset);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        reset();
        setAuthResolved(true);
        return;
      }

      // ⚠️ ואין כאן יצירת סלון ואין יצירת רשומת חבר. כשהיה סלון אחד, כניסה
      // ל-Google יצרה בקשת הצטרפות אליו. עם כמה סלונים זה היה יוצר בקשה לכל
      // סלון שמישהו הציץ בו. ההצטרפות היא פעולה, והיא במסך הבחירה.
      setUser({
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName ?? firebaseUser.email ?? 'חבר',
        email: firebaseUser.email ?? '',
        photoURL: firebaseUser.photoURL ?? undefined,
      });
      setAuthResolved(true);
    });
  }, [reset, setAuthResolved, setUser]);
}

/** רשימת הסלונים, ובאילו מהם יש לי רשומה. */
export function useBranchesBinding() {
  const user = useStore((state) => state.user);
  const setCanOpenBranch = useStore((state) => state.setCanOpenBranch);
  const setSystemClaimed = useStore((state) => state.setSystemClaimed);
  const branches = useStore((state) => state.branches);
  const setBranches = useStore((state) => state.setBranches);
  const setMyMemberships = useStore((state) => state.setMyMemberships);

  useEffect(() => {
    if (!user) return;
    return watchBranches(setBranches);
  }, [user, setBranches]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void Promise.all([isPlatformAdmin(user.uid), isSystemClaimed()]).then(
      ([allowed, claimed]) => {
        if (cancelled) return;
        setCanOpenBranch(allowed);
        setSystemClaimed(claimed);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user, setCanOpenBranch, setSystemClaimed]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void myMemberships(
      user.uid,
      branches.map((branch) => branch.id),
    ).then((found) => {
      if (!cancelled) setMyMemberships(found);
    });
    return () => {
      cancelled = true;
    };
  }, [user, branches, setMyMemberships]);
}

/** הסלון שאני בו: המסמך שלו, הרשומה שלי בו, ורשימת החברים. */
export function useCurrentBranchBinding(branchId: string | null) {
  const user = useStore((state) => state.user);
  const member = useStore((state) => state.member);
  const setBranch = useStore((state) => state.setBranch);
  const setMember = useStore((state) => state.setMember);
  const setMembers = useStore((state) => state.setMembers);

  useEffect(() => {
    if (!branchId) return;
    return watchBranch(branchId, setBranch);
  }, [branchId, setBranch]);

  useEffect(() => {
    if (!branchId || !user) return;
    return watchMember(branchId, user.uid, setMember);
  }, [branchId, user, setMember]);

  useEffect(() => {
    // ⚠️ תלוי ב-member ולא ב-user, וזה לא קוסמטי. סריקת החברים דורשת חברות,
    // ומאזין שנפתח לפני שהרשומה קיימת נדחה.
    // DOCS/PLANING/17-the-first-sign-in-could-never-work.md
    //
    // ⚠️⚠️ ולמנהלת בלבד. רשומת החבר מחזיקה מייל, ואין סיבה שהדפדפן של חבר
    // יחזיק את המיילים של כל השאר. החוק אוסר את זה עכשיו, ומאזין שנפתח
    // בכל זאת היה נדחה ומייצר שגיאה במסך.
    if (!branchId || !member || member.role !== 'manager') return;
    return watchMembers(branchId, setMembers);
  }, [branchId, member, setMembers]);
}

export function useMonthBinding(branchId: string | null) {
  const member = useStore((state) => state.member);
  const monthKey = useStore((state) => state.monthKey);
  const setShifts = useStore((state) => state.setShifts);
  const setActivityDays = useStore((state) => state.setActivityDays);
  const setAccessCodes = useStore((state) => state.setAccessCodes);

  useEffect(() => {
    if (!branchId || !member) return;
    const stops = [
      watchShiftsForMonth(branchId, monthKey, setShifts),
      watchActivityDaysForMonth(branchId, monthKey, setActivityDays),
      watchAccessCodes(branchId, setAccessCodes),
    ];
    return () => stops.forEach((stop) => stop());
  }, [branchId, member, monthKey, setShifts, setActivityDays, setAccessCodes]);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

export async function signOutOfSalon(): Promise<void> {
  await signOut(auth);
}
