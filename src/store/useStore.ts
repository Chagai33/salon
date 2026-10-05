// src/store/useStore.ts
//
// ⚠️ ה-Store הוא השתקפות קריאה בלבד של המסד.
// אל תתקן אותו ביד כדי ש"המסך ייראה נכון": קרא לשירות, והמאזין יעדכן.

import { create } from 'zustand';
import type { AccessCode, ActivityDay, Branch, Member, Shift, User } from '../types';
import { toMonthKey } from '../utils/dates';

interface AppState {
  user: User | null;
  member: Member | null;
  branch: Branch | null;
  members: Member[];
  monthKey: string;
  shifts: Shift[];
  activityDays: ActivityDay[];
  accessCodes: AccessCode[];
  isAuthResolved: boolean;
  isMonthLoading: boolean;
  error: string | null;

  setUser: (user: User | null) => void;
  setMember: (member: Member | null) => void;
  setBranch: (branch: Branch | null) => void;
  setMembers: (members: Member[]) => void;
  setMonthKey: (monthKey: string) => void;
  setShifts: (shifts: Shift[]) => void;
  setActivityDays: (days: ActivityDay[]) => void;
  setAccessCodes: (codes: AccessCode[]) => void;
  setAuthResolved: (resolved: boolean) => void;
  setMonthLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const blank = {
  user: null,
  member: null,
  branch: null,
  members: [],
  shifts: [],
  activityDays: [],
  accessCodes: [],
};

export const useStore = create<AppState>((set) => ({
  ...blank,
  monthKey: toMonthKey(new Date()),
  isAuthResolved: false,
  isMonthLoading: true,
  error: null,

  setUser: (user) => set({ user }),
  setMember: (member) => set({ member }),
  setBranch: (branch) => set({ branch }),
  setMembers: (members) => set({ members }),
  setMonthKey: (monthKey) => set({ monthKey, isMonthLoading: true }),
  setShifts: (shifts) => set({ shifts, isMonthLoading: false }),
  setActivityDays: (activityDays) => set({ activityDays }),
  setAccessCodes: (accessCodes) => set({ accessCodes }),
  setAuthResolved: (isAuthResolved) => set({ isAuthResolved }),
  setMonthLoading: (isMonthLoading) => set({ isMonthLoading }),
  setError: (error) => set({ error }),
  reset: () => set({ ...blank, isMonthLoading: false }),
}));

// בוררים.
//
// ⚠️⚠️ בורר שמוחזר ממנו ערך חדש בכל קריאה גורם ללולאה אינסופית.
//
// zustand גרסה 5 עובד דרך useSyncExternalStore, והוא משווה את מה שהבורר החזיר
// בהשוואת זהות. בורר שבונה Map או מערך חדש מחזיר הפניה חדשה בכל רינדור, React
// מסיק שהמצב השתנה, מרנדר שוב, והבורר בונה Map חדש. זו לולאה.
//
// זה קרה כאן בפועל, ושחזרתי אותו: React error 185, "Maximum update depth
// exceeded", והמסך נשאר ריק. DOCS/PLANING/16-the-selector-that-looped.md
//
// הכלל: בורר מחזיר ערך פרימיטיבי, או הפניה שכבר קיימת ב-Store.
// כל גזירה שבונה אובייקט נעשית ב-useMemo בתוך הרכיב.

export const selectIsManager = (state: AppState) => state.member?.role === 'manager';
export const selectIsActive = (state: AppState) => state.member?.status === 'active';

// ✅ מספרים. אלה בטוחים: ערך פרימיטיבי משווה בערך ולא בהפניה.
export const selectOpenShiftCount = (state: AppState) =>
  state.shifts.filter((shift) => !shift.assigneeMemberId).length;

export const selectHandoverCount = (state: AppState) =>
  state.shifts.filter((shift) => shift.handoverState === 'requested').length;

// ⚠️ אלה אינן בוררים ואינן נקראות עם useStore. הן פונקציות עזר שמקבלות את
// המערך ומוחזרות לתוך useMemo ברכיב.
export function groupShiftsByDate(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const list = map.get(shift.date) ?? [];
    list.push(shift);
    map.set(shift.date, list);
  }
  return map;
}

export function groupActivityByDate(days: ActivityDay[]): Map<string, ActivityDay> {
  const map = new Map<string, ActivityDay>();
  for (const day of days) map.set(day.date, day);
  return map;
}

/** מפרידה את הממתינים לאישור מהמאושרים. גם היא נקראת מתוך useMemo ברכיב. */
export function splitMembers(members: Member[]): {
  pending: Member[];
  approved: Member[];
} {
  return {
    pending: members.filter((member) => member.status === 'pending'),
    approved: members.filter((member) => member.status !== 'pending'),
  };
}
