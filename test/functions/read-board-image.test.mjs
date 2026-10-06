// test/functions/read-board-image.test.mjs
//
// ⚠️ הפונקציה הזו היא כתובת פתוחה לאינטרנט, ולכן השומרים שלה נבדקים ולא
// נקראים. בדיקה שקוראת את הקוד אינה בדיקה.
//
// ⚠️ ומה שנבדק כאן הוא הדחייה, לא ההצלחה: אסימון שלא נחתם, אסימון של פרויקט
// אחר, אסימון שפג, תמונה גדולה מדי, וסוג קובץ שאינו תמונה. קריאה אמיתית
// למודל אינה נבדקת, כי היא עולה כסף וצריכה מפתח.
//
// הרצה: node --test test/functions/

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJECT = 'hasalon-test';
const KID = 'test-kid';

let dir;
let certPem;
let keyPem;
let handler;
let realFetch;

function b64url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64url');
}

/** בונה אסימון חתום כמו ש-Firebase מנפיק, או אסימון פגום בכוונה. */
function idToken(overrides = {}, { sign = true } = {}) {
  const header = b64url({ alg: 'RS256', kid: KID, typ: 'JWT' });
  const payload = b64url({
    aud: PROJECT,
    iss: `https://securetoken.google.com/${PROJECT}`,
    sub: 'member-one',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });
  if (!sign) return `${header}.${payload}.${b64url('not-a-signature')}`;
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(keyPem).toString('base64url')}`;
}

function post(body, token) {
  return new Request('https://example.test/.netlify/functions/read-board-image', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const image = { imageBase64: 'AAAA', mimeType: 'image/png', monthKey: '2026-10' };

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'salon-fn-'));
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=test',
  ], { stdio: 'ignore' });
  keyPem = readFileSync(key, 'utf8');
  certPem = readFileSync(cert, 'utf8');

  process.env.GEMINI_API_KEY = 'not-a-real-key';
  process.env.FIREBASE_PROJECT_ID = PROJECT;

  // ⚠️ מחזיק את התעודה במקום הרשת. בלי זה הבדיקה תלויה בגוגל.
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('securetoken@system')) {
      return new Response(JSON.stringify({ [KID]: certPem }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    // ⚠️ קריאה למודל נחסמת. אם בדיקה מגיעה לכאן, השומר לא עשה את שלו.
    throw new Error('הבדיקה ניסתה לקרוא למודל');
  };

  ({ default: handler } = await import('../../netlify/functions/read-board-image.mjs'));
});

after(() => {
  globalThis.fetch = realFetch;
  rmSync(dir, { recursive: true, force: true });
});

describe('השומרים', () => {
  it('GET נדחה', async () => {
    const res = await handler(new Request('https://example.test', { method: 'GET' }));
    assert.equal(res.status, 405);
  });

  it('⚠️ בלי אסימון אין גישה', async () => {
    const res = await handler(post(image));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, 'noToken');
  });

  it('⚠️⚠️ אסימון שלא נחתם נדחה', async () => {
    const res = await handler(post(image, idToken({}, { sign: false })));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, 'badToken');
  });

  it('⚠️ אסימון של פרויקט אחר נדחה', async () => {
    const res = await handler(post(image, idToken({ aud: 'another-project' })));
    assert.equal(res.status, 401);
  });

  it('⚠️ אסימון שפג נדחה', async () => {
    const res = await handler(post(image, idToken({ exp: Math.floor(Date.now() / 1000) - 60 })));
    assert.equal(res.status, 401);
  });

  it('⚠️ מנפיק שאינו Firebase נדחה', async () => {
    const res = await handler(post(image, idToken({ iss: 'https://evil.example' })));
    assert.equal(res.status, 401);
  });
});

describe('הקלט', () => {
  it('סוג קובץ שאינו תמונה נדחה', async () => {
    const res = await handler(post({ ...image, mimeType: 'application/pdf' }, idToken()));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'badImage');
  });

  it('חודש בפורמט שגוי נדחה', async () => {
    const res = await handler(post({ ...image, monthKey: 'אוקטובר' }, idToken()));
    assert.equal(res.status, 400);
  });

  it('⚠️ תמונה גדולה מדי נדחית לפני שנקרא למודל', async () => {
    const big = 'A'.repeat(3 * 1024 * 1024);
    const res = await handler(post({ ...image, imageBase64: big }, idToken()));
    assert.equal(res.status, 413);
  });
});

describe('ההגדרה', () => {
  it('בלי מפתח המודל, הודעה שאומרת מה חסר', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await handler(post(image, idToken()));
    process.env.GEMINI_API_KEY = 'not-a-real-key';
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error, 'missingKey');
  });
});
