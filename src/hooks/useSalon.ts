// src/hooks/useSalon.ts
//
// מחבר את המאזינים ל-Store. רכיב אינו פותח מאזין בעצמו.
//
// ⚠️ ושלוש שכבות ולא אחת: מי אני, אילו סלונים יש, ומה יש בסלון שאני בו.
// כל שכבה ממתינה לקודמת, כי קריאה לתוך סלון דורשת רשומת חבר בו.

import { useEffect, useMemo } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useStore } from '../store/useStore';
import type { Shift } from '../types';
import {
  fetchAccessCode,
  isPlatformAdmin,
  isSystemClaimed,
  myMemberships,
  watchAccessCodes,
  watchActivityDaysForMonth,
  watchBranch,
  watchBranches,
  watchMember,
  watchMembers,
  watchShift,
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

  useEffect(() => {
    if (!branchId || !member) return;
    const stops = [
      watchShiftsForMonth(branchId, monthKey, setShifts),
      watchActivityDaysForMonth(branchId, monthKey, setActivityDays),
    ];
    return () => stops.forEach((stop) => stop());
  }, [branchId, member, monthKey, setShifts, setActivityDays]);
}

/**
 * חתימת המשמרות של החבר בחודש שנטען, כמחרוזת אחת.
 *
 * ⚠️ שתי הדרכים לזכאות ולא אחת: משמרת שהוא מחזיק, ומשמרת שהוא מסר בהחלפה.
 * src/utils/eligibility.ts
 */
function myShiftSignature(shifts: Shift[], memberId: string): string {
  if (!memberId) return '';
  return shifts
    .filter(
      (shift) =>
        shift.assigneeMemberId === memberId || shift.handoverFromMemberId === memberId,
    )
    .map((shift) => `${shift.date}:${shift.assigneeMemberId ?? ''}:${shift.handoverState ?? ''}`)
    .sort()
    .join('|');
}

/**
 * ⚠️⚠️ קוד הכניסה, ושני מסלולים נפרדים לשני אנשים.
 *
 * **המנהלת** מאזינה לאוסף, כי היא זו שמגדירה את הקוד והחוק מתיר לה לקרוא.
 * **החבר** אינו קורא את האוסף כלל: מאז 26/10/2026 החוק דוחה אותו, והוא מקבל
 * את הקוד מפונקציית הענן, שמחשבת את הזכאות בצד השרת.
 * DOCS/PLANING/15-the-code-is-not-enforced-yet.md
 *
 * ⚠️ ומי שאינו פעיל אינו פותח כלום. קודם המאזין נפתח גם לממתין לאישור,
 * והחוק דחה אותו ויצר שגיאה במסך.
 */
export function useAccessCodeBinding(branchId: string | null) {
  const member = useStore((state) => state.member);
  const shifts = useStore((state) => state.shifts);
  const setAccessCodes = useStore((state) => state.setAccessCodes);
  const setCodeAnswer = useStore((state) => state.setCodeAnswer);

  const isActive = member?.status === 'active';
  const isManager = isActive && member?.role === 'manager';

  /*
    ⚠️ מחרוזת ולא מערך, וזה לא קוסמטי. מה שמחזיר אובייקט חדש בכל קריאה מפעיל
    את האפקט שוב ושוב, וזו הלולאה שהפילה את המסך. DOCS/PLANING/16

    ⚠️ וזה הטריגר לקריאה חוזרת: חבר שתפס משמרת עכשיו צריך לראות את הקוד בלי
    לרענן את הדף.
  */
  const mine = useMemo(() => myShiftSignature(shifts, member?.id ?? ''), [shifts, member?.id]);

  useEffect(() => {
    if (!branchId || !isManager) return;
    return watchAccessCodes(branchId, setAccessCodes);
  }, [branchId, isManager, setAccessCodes]);

  useEffect(() => {
    if (!branchId || !isActive || isManager) return;

    // ⚠️ `cancelled` ולא ביטול הבקשה. תשובה שחוזרת אחרי מעבר לסלון אחר היא
    // הקוד של הסלון הקודם, ואסור שתיכתב ל-Store.
    let cancelled = false;
    void fetchAccessCode(branchId)
      .then((answer) => {
        if (!cancelled) setCodeAnswer(answer);
      })
      .catch(() => {
        // ⚠️ ושקט במסך, ולא שגיאה אדומה. המסך אומר "הקוד עוד לא עודכן",
        // וזה מה שידוע בפועל כשהתשובה לא חזרה.
        if (!cancelled) setCodeAnswer(null);
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, isActive, isManager, mine, setCodeAnswer]);
}

/**
 * המשמרת שהלינק מצביע עליה.
 *
 * ⚠️ מאזין משלה ולא חיפוש ב-Store: הלינק לבקשת מחליף יכול להצביע על חודש
 * שהלוח אינו מציג. DOCS/PLANING/28
 *
 * ⚠️ ותלוי ב-member ולא ב-user: קריאת משמרת דורשת חברות בסלון, ומאזין שנפתח
 * לפני שהרשומה קיימת נדחה. DOCS/PLANING/17
 */
export function useShiftBinding(branchId: string | null, shiftId: string | null) {
  const member = useStore((state) => state.member);
  const setLinkedShift = useStore((state) => state.setLinkedShift);

  useEffect(() => {
    if (!branchId || !shiftId || !member) return;
    return watchShift(branchId, shiftId, setLinkedShift);
  }, [branchId, shiftId, member, setLinkedShift]);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

export async function signOutOfSalon(): Promise<void> {
  await signOut(auth);
}
