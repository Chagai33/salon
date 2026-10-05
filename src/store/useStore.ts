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

// בוררים. רכיב אינו מחשב את אלה בעצמו.

export const selectIsManager = (state: AppState) => state.member?.role === 'manager';
export const selectIsActive = (state: AppState) => state.member?.status === 'active';

export const selectShiftsByDate = (state: AppState) => {
  const map = new Map<string, Shift[]>();
  for (const shift of state.shifts) {
    const list = map.get(shift.date) ?? [];
    list.push(shift);
    map.set(shift.date, list);
  }
  return map;
};

export const selectActivityByDate = (state: AppState) => {
  const map = new Map<string, ActivityDay>();
  for (const day of state.activityDays) map.set(day.date, day);
  return map;
};

export const selectOpenShiftCount = (state: AppState) =>
  state.shifts.filter((shift) => !shift.assigneeMemberId).length;

export const selectHandoverCount = (state: AppState) =>
  state.shifts.filter((shift) => shift.handoverState === 'requested').length;
