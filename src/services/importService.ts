// src/services/importService.ts
//
// קורא תמונה של לוח חודשי דרך פונקציית Netlify.
//
// ⚠️⚠️ והאפליקציה אינה מחזיקה את מפתח המודל ואינה יכולה להחזיק אותו. כל מה
// שמתחיל ב-`VITE_` נדחף לחבילה שהדפדפן מוריד, והמאגר הזה ציבורי. המפתח יושב
// במשתנה סביבה של Netlify, והפונקציה היא היחידה שרואה אותו.
//
// ⚠️ והפונקציה אינה כותבת למסד. היא מחזירה הצעה.

import { auth } from '../lib/firebase';

export type ImportedAccess = 'open' | 'membersOnly' | 'closed';

export interface ImportedEvent {
  title: string;
  startTime?: string;
  endTime?: string;
}

export interface ImportedDay {
  date: string;
  note: string;
  access: ImportedAccess;
  events: ImportedEvent[];
  /** 0 עד 1. ⚠️ מוצג למנהלת, כדי שהיא תדע במה לא לסמוך. */
  confidence: number;
}

const ENDPOINT = '/.netlify/functions/read-board-image';

/** ⚠️ שני מגה, כמו בפונקציה. נבדק כאן כדי לא לשלוח ולהיכשל. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class ImportError extends Error {}

function base64Of(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new ImportError('readFailed'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      // `data:image/png;base64,XXXX`, והפונקציה רוצה את XXXX בלבד.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

export async function readBoardImage(file: File, monthKey: string): Promise<ImportedDay[]> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new ImportError('badType');
  if (file.size > MAX_IMAGE_BYTES) throw new ImportError('tooLarge');

  // ⚠️ אסימון הזהות, ולא "האפליקציה מדברת עם הפונקציה". בלעדיו הכתובת פתוחה
  // לכל העולם וכל מי שימצא אותה שורף את המכסה.
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new ImportError('noToken');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      imageBase64: await base64Of(file),
      mimeType: file.type,
      monthKey,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ImportError(body.error ?? 'modelFailed');
  }

  const body = (await response.json()) as { days?: ImportedDay[] };
  return Array.isArray(body.days) ? body.days : [];
}
