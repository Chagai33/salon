import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

/*
  גרסת האפליקציה ותאריך הבנייה.

  בהכרעת בעל המוצר 06/10: בלי זה אי אפשר לדעת אם מה שרואים על המסך הוא לפני
  תיקון או אחריו, וזה קרה פעמיים באותו יום. DOCS/PLANING/26

  ⚠️⚠️ ומודול וירטואלי ולא `define`.
  נמדד על השרת הזה: `define` לא הוחלף בכלל במצב פיתוח, והקוד קיבל שם שאינו
  מוגדר. מודול וירטואלי עובר דרך אותו צינור בשתי הסביבות, והייבוא שלו הוא
  ייבוא רגיל שגם TypeScript מבין.
*/
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

const VIRTUAL = 'virtual:app-version'
const RESOLVED = '\0' + VIRTUAL

function appVersion() {
  return {
    name: 'app-version',
    resolveId(id: string) {
      return id === VIRTUAL ? RESOLVED : null
    },
    load(id: string) {
      if (id !== RESOLVED) return null
      // תאריך בלבד, ולא שעה. ⚠️ שורה בפוטר, לא יומן.
      const date = new Date().toISOString().slice(0, 10)
      return [
        `export const version = ${JSON.stringify(pkg.version)};`,
        `export const buildDate = ${JSON.stringify(date)};`,
      ].join('\n')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), appVersion()],
})
