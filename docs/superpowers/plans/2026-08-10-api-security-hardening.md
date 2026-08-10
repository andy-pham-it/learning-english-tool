# API Security & Configuration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the three `/api/*` Vercel functions (auth, rate limiting, validation, generic errors), restrict Firestore dictionary data to per-user ownership, fix Vercel/local-dev configuration, and add secret-scanning + audit tooling.

**Architecture:** Shared `web/api/lib/` modules (Firebase ID-token verification via `jose` on Node+Edge runtimes, in-memory per-uid sliding-window rate limiter, input validation/sanitization, response helpers) used by all three handlers. Firestore rules switch `dictionary/{word}` to `users/{uid}/dictionary/{word}` with ownership + data validation. Frontend attaches `Authorization: Bearer <Firebase ID token>` at all 5 API call sites via a shared helper and points dictionary reads/writes at per-user paths.

**Tech Stack:** Node.js/Edge Vercel functions, `jose` (JWT), Firebase Auth/Firestore, Angular 18, husky, GitHub Actions.

## Global Constraints

- Commands run inside `web/` unless noted. Repo root has NO package.json today — one is created for husky.
- `jose` must be added to `web/package.json` `dependencies` (works on Node 18+ AND Edge via WebCrypto — `firebase-admin` does NOT work on Edge, which is why we cannot use it in chat.js/tts.js).
- Firebase projectId `learning-english-tool`; ID-token issuer `https://securetoken.google.com/learning-english-tool`; audience = projectId; algorithm RS256.
- Public Firebase web API key `AIzaSyD42z5IasZJwHDidl4pbgzv6vIzA3d2JdA` (in `web/src/environments/environment.ts`) is NOT a secret — the pre-commit hook must allowlist it.
- Never log API keys, full Gemini URLs, or raw prompt text. `console.error` allowed for diagnostics only.
- All client-facing errors are generic; success payloads/shapes must NOT change (`dictionary` → raw JSON object, `chat` → `{reply}`, `tts` → `{audio}`).
- Gemini prompts/behavior must remain byte-identical in content (only validation/auth/error paths change).
- Commit style: lowercase `type(scope): description` (repo convention, e.g. `fix(phrase-lab): ...`).

---

### Task 1: Shared API library + unit tests

**Files:**
- Create: `web/api/lib/auth.js`
- Create: `web/api/lib/rate-limit.js`
- Create: `web/api/lib/validate.js`
- Create: `web/api/lib/http.js`
- Create: `web/api/lib/validate.test.js`
- Create: `web/api/lib/rate-limit.test.js`
- Modify: `web/package.json` (add `jose` dep + `test:api` script)

**Interfaces:**
- Produces: `authenticate(req) → Promise<{uid: string} | null>`; `checkRateLimit(uid) → {allowed: boolean, retryAfterSeconds?: number}`; `sanitizeWord(raw) → string | null`; `validateChatMessages(raw) → {ok, error?, messages?}`; `validateTts(raw) → {ok, error?, text?, voice?}`; `nodeJson(res, status, body)`; `edgeJson(status, body)`.

- [ ] **Step 1: Install jose and add test:api script**

Run in `web/`: `npm install jose`

Then edit `web/package.json` scripts block, adding:
```json
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "test:api": "node --test api/lib/*.test.js"
```

- [ ] **Step 2: Create `web/api/lib/http.js`**

```js
// Minimal response helpers shared by the /api functions.

export function nodeJson(res, status, body) {
  return res.status(status).json(body);
}

export function edgeJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: Create `web/api/lib/auth.js`**

```js
// Firebase ID-token verification for Vercel serverless functions.
// Works on both Node.js and Edge runtimes (pure WebCrypto via jose).
import { importX509, jwtVerify } from 'jose';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'learning-english-tool';

const CERTS_URI =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const CERTS_TTL_MS = 60 * 60 * 1000; // Google rotates signing certs ~hourly

let certsCache = {}; // kid -> PEM certificate
let certsFetchedAt = 0;

async function refreshCerts() {
  const res = await fetch(CERTS_URI, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch Firebase signing certificates');
  }
  certsCache = await res.json(); // { kid: PEM-cert-string }
  certsFetchedAt = Date.now();
}

async function getKey(header) {
  if (!header.kid) throw new Error('ID token missing kid');
  if (!certsCache[header.kid]) {
    // Unknown/rotated key: force a refresh, bounded to misses.
    await refreshCerts();
  }
  const pem = certsCache[header.kid];
  if (!pem) throw new Error('Unknown Firebase signing key');
  return importX509(pem, 'RS256');
}

async function refreshCertsIfStale() {
  if (Date.now() - certsFetchedAt > CERTS_TTL_MS) {
    await refreshCerts();
  }
}

export async function verifyFirebaseToken(idToken) {
  await refreshCertsIfStale();
  const { payload } = await jwtVerify(idToken, getKey, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
    algorithms: ['RS256'],
  });
  if (!payload.sub) {
    throw new Error('ID token missing subject');
  }
  return { uid: payload.sub };
}

// Returns { uid } for a valid Bearer token, otherwise null.
export async function authenticate(req) {
  const header = req.headers.get?.('authorization') || req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    return await verifyFirebaseToken(token);
  } catch (err) {
    console.error('[auth] Token verification failed:', err.message);
    return null;
  }
}
```

- [ ] **Step 4: Create `web/api/lib/rate-limit.js`**

```js
// In-memory sliding-window rate limiter keyed by user uid.
// NOTE: Vercel serverless instances are ephemeral; this is a best-effort
// per-instance limiter, not a global quota (zero-cost per AGENTS.md).
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 100; // per uid per window

const hits = new Map(); // uid -> number[] of request timestamps

function sweep(now) {
  if (hits.size > 10000) {
    for (const [uid, timestamps] of hits) {
      const recent = timestamps.filter((t) => now - t < WINDOW_MS);
      if (recent.length === 0) hits.delete(uid);
      else hits.set(uid, recent);
    }
  }
}

export function checkRateLimit(uid) {
  const now = Date.now();
  sweep(now);

  const timestamps = hits.get(uid) || [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    hits.set(uid, recent);
    const retryAfterSeconds = Math.ceil((recent[0] + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  hits.set(uid, recent);
  return { allowed: true };
}
```

- [ ] **Step 5: Create `web/api/lib/validate.js`**

```js
// Input validation / sanitization shared by the /api functions.

const VOICES = new Set([
  'Zephyr','Puck','Charon','Kore','Fenrir','Leda','Orus','Aoede','Callirrhoe','Autonoe',
  'Enceladus','Iapetus','Umbriel','Algieba','Despina','Erinome','Algenib','Rasalgethi',
  'Laomedeia','Achernar','Alnilam','Schedar','Gacrux','Pulcherrima','Achird','Zubenelgenubi',
  'Vindemiatrix','Sadachbia','Sadaltager','Sulafat',
]);

export function sanitizeWord(raw) {
  if (typeof raw !== 'string') return null;
  const word = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim(); // strip control chars
  if (word.length < 1 || word.length > 100) return null;
  return word;
}

export function validateChatMessages(raw) {
  if (!Array.isArray(raw)) return { ok: false, error: 'messages must be an array' };
  if (raw.length < 1 || raw.length > 100) {
    return { ok: false, error: 'messages must contain between 1 and 100 entries' };
  }
  let totalChars = 0;
  for (const msg of raw) {
    if (!msg || typeof msg !== 'object') return { ok: false, error: 'invalid message entry' };
    if (msg.role !== 'user' && msg.role !== 'model') {
      return { ok: false, error: 'message role must be "user" or "model"' };
    }
    if (!Array.isArray(msg.parts) || msg.parts.length < 1 || msg.parts.length > 10) {
      return { ok: false, error: 'message parts must be an array of 1-10 items' };
    }
    for (const part of msg.parts) {
      if (!part || typeof part.text !== 'string') {
        return { ok: false, error: 'message part must have a text string' };
      }
      const clean = part.text.replace(/[\u0000-\u001f\u007f]/g, '').trim();
      if (clean.length < 1 || clean.length > 4000) {
        return { ok: false, error: 'message text must be 1-4000 characters' };
      }
      part.text = clean;
      totalChars += clean.length;
    }
  }
  if (totalChars > 24000) return { ok: false, error: 'total message length too long' };
  return { ok: true, messages: raw };
}

export function validateTts(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid request body' };
  const { text, voice } = raw;
  if (typeof text !== 'string') return { ok: false, error: 'text is required' };
  const clean = text.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (clean.length < 1 || clean.length > 1000) {
    return { ok: false, error: 'text must be 1-1000 characters' };
  }
  const chosenVoice = voice === undefined || voice === null ? 'Kore' : voice;
  if (typeof chosenVoice !== 'string' || !VOICES.has(chosenVoice)) {
    return { ok: false, error: 'unsupported voice' };
  }
  return { ok: true, text: clean, voice: chosenVoice };
}
```

- [ ] **Step 6: Create `web/api/lib/validate.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeWord, validateChatMessages, validateTts } from './validate.js';

test('sanitizeWord strips control chars and trims', () => {
  assert.equal(sanitizeWord('  hello\nworld\u0000 '), 'helloworld');
});

test('sanitizeWord rejects non-strings, empty, over 100 chars', () => {
  assert.equal(sanitizeWord(42), null);
  assert.equal(sanitizeWord('   '), null);
  assert.equal(sanitizeWord('a'.repeat(101)), null);
});

test('validateChatMessages accepts valid messages and strips control chars', () => {
  const res = validateChatMessages([{ role: 'user', parts: [{ text: 'hi\u0000 there' }] }]);
  assert.equal(res.ok, true);
  assert.equal(res.messages[0].parts[0].text, 'hi there');
});

test('validateChatMessages rejects bad roles / overlong text / too many messages', () => {
  assert.equal(validateChatMessages([{ role: 'admin', parts: [{ text: 'x' }] }]).ok, false);
  assert.equal(validateChatMessages([{ role: 'user', parts: [{ text: 'x'.repeat(4001) }] }]).ok, false);
  assert.equal(
    validateChatMessages(Array.from({ length: 101 }, () => ({ role: 'user', parts: [{ text: 'x' }] }))).ok,
    false
  );
  const ok = validateChatMessages([
    { role: 'user', parts: [{ text: 'x'.repeat(1000) }] },
    { role: 'model', parts: [{ text: 'x'.repeat(1000) }] },
  ]);
  assert.equal(ok.ok, true);
});

test('validateTts caps text length and whitelists voices', () => {
  assert.equal(validateTts({ text: '' }).ok, false);
  assert.equal(validateTts({ text: 'x'.repeat(1001) }).ok, false);
  assert.equal(validateTts({ text: 'hello', voice: 'NotARealVoice' }).ok, false);
  const ok = validateTts({ text: '  hello  ', voice: 'Kore' });
  assert.equal(ok.ok, true);
  assert.equal(ok.text, 'hello');
  assert.equal(ok.voice, 'Kore');
  assert.equal(validateTts({ text: 'hi' }).voice, 'Kore'); // default
});
```

- [ ] **Step 7: Create `web/api/lib/rate-limit.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit } from './rate-limit.js';

test('allows up to 100 and blocks the next request', () => {
  for (let i = 0; i < 100; i++) {
    assert.equal(checkRateLimit('u1').allowed, true);
  }
  const blocked = checkRateLimit('u1');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test('different uids have independent limits', () => {
  for (let i = 0; i < 100; i++) checkRateLimit('u2');
  assert.equal(checkRateLimit('u3').allowed, true);
});
```

- [ ] **Step 8: Run tests and verify green**

Run in `web/`: `npm run test:api`
Expected: all tests pass (`# pass` for both files, exit 0).

- [ ] **Step 9: Commit**

```bash
git add web/package.json web/package-lock.json web/api/lib/
git commit -m "feat(api): add shared auth, rate-limit, and validation library"
```

---

### Task 2: Harden `web/api/dictionary.js`

**Files:**
- Modify: `web/api/dictionary.js` (full rewrite)

**Interfaces:**
- Consumes: `authenticate`, `checkRateLimit`, `sanitizeWord`, `nodeJson` from `./lib/*`.
- Produces: unchanged success shape (raw parsed JSON object).

- [ ] **Step 1: Rewrite `web/api/dictionary.js`**

Replace the entire file with:

```js
import { authenticate } from './lib/auth.js';
import { checkRateLimit } from './lib/rate-limit.js';
import { sanitizeWord } from './lib/validate.js';
import { nodeJson } from './lib/http.js';

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return nodeJson(res, 405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured.');
    return nodeJson(res, 500, { error: 'Service is not configured.' });
  }

  // 1. Authenticate
  const user = await authenticate(req);
  if (!user) {
    return nodeJson(res, 401, { error: 'Unauthorized' });
  }

  // 2. Rate limit per user
  const rate = checkRateLimit(user.uid);
  if (!rate.allowed) {
    return nodeJson(res, 429, {
      error: 'Rate limit exceeded. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  try {
    const { word } = req.body || {};

    // 3. Validate / sanitize input
    const cleanWord = sanitizeWord(word);
    if (!cleanWord) {
      return nodeJson(res, 400, { error: 'word must be a string of 1-100 characters' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const prompt = `You are a professional English-Vietnamese dictionary.
Analyze the word: "${cleanWord}"

You MUST return a JSON object with this EXACT structure:
{
  "word": "${cleanWord}",
  "phonetic": "IPA pronunciation",
  "entries": [
    {
      "partOfSpeech": "noun/verb/adjective...",
      "definitions": [
        {
          "en": "concise english definition",
          "vi": "nghĩa tiếng Việt (MANDATORY)",
          "example": "example sentence",
          "exampleVi": "dịch ví dụ sang tiếng Việt"
        }
      ]
    }
  ],
  "collocations": [
    {
      "phrase": "common phrase or phrasal verb",
      "meaning": "Vietnamese meaning",
      "exampleEn": "english example",
      "exampleVi": "vietnamese example"
    }
  ]
}

CRITICAL: 
1. Translate all definitions and ALL examples into Vietnamese.
2. Provide at least 3-5 common collocations or phrasal verbs related to the word.
Return ONLY the raw JSON object.`;

    const geminiRequestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error (dictionary):', errorText);
      return nodeJson(res, 502, { error: 'Upstream service error. Please try again.' });
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let resultText = parts.map((p) => p.text).join('').trim();

    if (!resultText) {
      return nodeJson(res, 502, { error: 'Upstream service returned no data.' });
    }

    // Robust JSON extraction: first '{' to last '}'
    const firstBrace = resultText.indexOf('{');
    const lastBrace = resultText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      resultText = resultText.substring(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(resultText);
      return nodeJson(res, 200, parsed);
    } catch (parseError) {
      console.error('Gemini returned invalid JSON (dictionary):', parseError.message);
      return nodeJson(res, 502, { error: 'Upstream service returned an invalid response.' });
    }
  } catch (error) {
    console.error('Handler error (dictionary):', error.message);
    return nodeJson(res, 500, { error: 'Internal Server Error' });
  }
}
```

- [ ] **Step 2: Sanity-check**

Run `node --check api/dictionary.js` in `web/` — expect no syntax errors. Also confirm via `grep -n "Using API Key\|Calling Gemini\|detail" web/api/dictionary.js` that key logging and `detail` leaks are GONE.

- [ ] **Step 3: Commit**

```bash
git add web/api/dictionary.js
git commit -m "fix(api): harden dictionary endpoint with auth, rate limit, validation, generic errors"
```

---

### Task 3: Harden `web/api/chat.js`

**Files:**
- Modify: `web/api/chat.js` (full rewrite)

- [ ] **Step 1: Rewrite `web/api/chat.js`**

Replace the entire file with:

```js
import { authenticate } from './lib/auth.js';
import { checkRateLimit } from './lib/rate-limit.js';
import { validateChatMessages } from './lib/validate.js';
import { edgeJson } from './lib/http.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return edgeJson(405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured.');
    return edgeJson(500, { error: 'Service is not configured.' });
  }

  // 1. Authenticate
  const user = await authenticate(req);
  if (!user) {
    return edgeJson(401, { error: 'Unauthorized' });
  }

  // 2. Rate limit per user
  const rate = checkRateLimit(user.uid);
  if (!rate.allowed) {
    return edgeJson(429, {
      error: 'Rate limit exceeded. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  try {
    const body = await req.json();
    const { messages } = body || {};

    // 3. Validate message shape
    const validation = validateChatMessages(messages);
    if (!validation.ok) {
      return edgeJson(400, { error: validation.error });
    }

    const systemInstruction = {
      parts: [{
        text: `You are a strict, demanding but ultimately educational IT Manager in a multinational company. 
The user is your employee. You must converse in English. 
Your goals:
1. Always stay in character as the Boss. Be demanding about deadlines, code quality, and professional communication.
2. If the user makes English grammar or vocabulary mistakes, correct them firmly but politely in your response before moving the conversation forward.
3. Keep responses relatively short (2-4 sentences max), resembling a real chat conversation.`
      }]
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const geminiRequestBody = {
      system_instruction: systemInstruction,
      contents: validation.messages,
      generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error (chat):', errorText);
      return edgeJson(502, { error: 'Upstream service error. Please try again.' });
    }

    const data = await response.json();
    const replyText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I have nothing to say. Get back to work.";

    return edgeJson(200, { reply: replyText });
  } catch (error) {
    console.error('Handler error (chat):', error.message);
    return edgeJson(500, { error: 'Internal Server Error' });
  }
}
```

- [ ] **Step 2: Sanity-check**

Run `node --check api/chat.js` in `web/` — expect no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add web/api/chat.js
git commit -m "fix(api): harden chat endpoint with auth, rate limit, validation, generic errors"
```

---

### Task 4: Harden `web/api/tts.js`

**Files:**
- Modify: `web/api/tts.js` (full rewrite)

- [ ] **Step 1: Rewrite `web/api/tts.js`**

Replace the entire file with:

```js
import { authenticate } from './lib/auth.js';
import { checkRateLimit } from './lib/rate-limit.js';
import { validateTts } from './lib/validate.js';
import { edgeJson } from './lib/http.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return edgeJson(405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured.');
    return edgeJson(500, { error: 'Service is not configured.' });
  }

  // 1. Authenticate
  const user = await authenticate(req);
  if (!user) {
    return edgeJson(401, { error: 'Unauthorized' });
  }

  // 2. Rate limit per user
  const rate = checkRateLimit(user.uid);
  if (!rate.allowed) {
    return edgeJson(429, {
      error: 'Rate limit exceeded. Please try again later.',
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  try {
    const body = await req.json();

    // 3. Validate input (text length cap + voice whitelist)
    const validation = validateTts(body);
    if (!validation.ok) {
      return edgeJson(400, { error: validation.error });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const geminiRequestBody = {
      contents: [{ parts: [{ text: validation.text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: validation.voice },
          },
        },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error (tts):', errorText);
      return edgeJson(502, { error: 'Upstream service error. Please try again.' });
    }

    const data = await response.json();
    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return edgeJson(502, { error: 'Upstream service returned no audio.' });
    }

    return edgeJson(200, { audio: base64Audio });
  } catch (error) {
    console.error('Handler error (tts):', error.message);
    return edgeJson(500, { error: 'Internal Server Error' });
  }
}
```

- [ ] **Step 2: Sanity-check**

Run `node --check api/tts.js` in `web/` — expect no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add web/api/tts.js
git commit -m "fix(api): harden tts endpoint with auth, rate limit, validation, generic errors"
```

---

### Task 5: Per-user Firestore rules

**Files:**
- Modify: `web/firestore.rules`

- [ ] **Step 1: Rewrite `web/firestore.rules`**

Replace the entire file with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /phrase_chunks/{id} {
      allow read: if true;
    }
    match /phrase_templates/{id} {
      allow read: if true;
    }
    match /phrase_progress/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    // Dictionary entries are private per-user (path: users/{uid}/dictionary/{word}).
    match /users/{uid}/dictionary/{word} {
      allow read, delete: if request.auth.uid == uid;
      allow create, update: if request.auth.uid == uid
        && word is string
        && word.size() >= 1 && word.size() <= 100
        && request.resource.data.word == word
        && request.resource.data.timestamp is timestamp
        && request.resource.data.entries is list
        && request.resource.data.entries.all(entry,
          entry.partOfSpeech is string
          && entry.definitions is list
          && entry.definitions.all(def,
            def.en is string
            && def.vi is string
          )
        );
    }

    // RECOMMENDED: enable Firebase App Check (Web) to reject calls that do
    // not originate from your app, preventing token abuse from external
    // clients. See: https://firebase.google.com/docs/app-check/web
  }
}
```

- [ ] **Step 2: Validate rules syntax**

Run `npx firebase-tools firestore:rules:compile --rules-file firestore.rules` in `web/` (or `npx firebase deploy --only firestore:rules --dry-run` if logged in). If firebase-tools isn't installed, install with `npm i -D firebase-tools` first. Expect a successful compile with no errors.

- [ ] **Step 3: Commit**

```bash
git add web/firestore.rules web/firebase.json web/firestore.indexes.json
git commit -m "feat(security): restrict dictionary Firestore data to per-user ownership with validation"
```

(Commits the previously-untracked `web/firebase.json` and `web/firestore.indexes.json` — they are project config, not secrets. `web/.firebaserc` stays untracked and is added to `.gitignore` in Task 8.)

---

### Task 6: Frontend auth headers + per-user Firestore paths

**Files:**
- Create: `web/src/app/core/services/firebase-token.ts`
- Modify: `web/src/app/core/services/dictionary.service.ts`
- Modify: `web/src/app/sub-app/dictionary/dictionary-ai.service.ts`
- Modify: `web/src/app/core/services/chat.service.ts`
- Modify: `web/src/app/features/think-aloud/services/speech.service.ts`
- Modify: `web/src/app/features/think-aloud/components/pattern-card/pattern-card.component.ts`

**Interfaces:**
- Consumes (new): `buildAuthHeaders(auth: Auth): Promise<Record<string, string>>` — returns `{'Content-Type': 'application/json'}` plus `Authorization: Bearer <idToken>` when a user is signed in.

- [ ] **Step 1: Create `web/src/app/core/services/firebase-token.ts`**

```ts
import { Auth } from '@angular/fire/auth';

/**
 * Builds request headers for /api/* calls, attaching the current user's
 * Firebase ID token as a Bearer token when signed in.
 */
export async function buildAuthHeaders(auth: Auth): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (!user) {
    return headers;
  }
  try {
    const token = await user.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.error('[firebase-token] Failed to obtain ID token:', err);
  }
  return headers;
}
```

- [ ] **Step 2: Edit `web/src/app/core/services/dictionary.service.ts`**

Add import after the existing `Auth` import:
```ts
import { buildAuthHeaders } from './firebase-token';
```

Replace `lookup()`:
```ts
  async lookup(word: string): Promise<DictionaryResult> {
    const normalizedWord = word.trim().toLowerCase();
    const user = this.auth.currentUser;

    // 1. Check the user's Firestore 'dictionary' collection (per-user cache)
    if (user) {
      const docRef = doc(this.firestore, `users/${user.uid}/dictionary`, normalizedWord);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          console.log(`[DictionaryService] Cache hit for "${normalizedWord}"`);
          return docSnap.data() as DictionaryResult;
        }
      } catch (err) {
        console.error('[DictionaryService] Error fetching from Firestore:', err);
      }
    }

    console.log(`[DictionaryService] Cache miss for "${normalizedWord}", calling API...`);
    // 2. Not found or error, call API
    try {
      const headers = await buildAuthHeaders(this.auth);
      const result = await firstValueFrom(
        this.http.post<DictionaryResult>(this.apiUrl, { word: normalizedWord }, { headers })
      );

      // 3. Save to DB (per-user)
      if (!result.error && user) {
        try {
          const docRef = doc(this.firestore, `users/${user.uid}/dictionary`, normalizedWord);
          await setDoc(docRef, {
            ...result,
            timestamp: serverTimestamp()
          });
          console.log(`[DictionaryService] Saved "${normalizedWord}" to Firestore`);
        } catch (dbErr) {
          console.error('[DictionaryService] Error saving to Firestore:', dbErr);
        }
      }
      return result;
    } catch (apiErr) {
      console.error('[DictionaryService] Dictionary API call failed:', apiErr);
      return { word: normalizedWord, phonetic: '', entries: [], error: 'Could not fetch definition. Please try again.' } as DictionaryResult;
    }
  }
```

Replace `getSavedWords()`:
```ts
  async getSavedWords(limitCount: number = 50): Promise<any[]> {
    const user = this.auth.currentUser;
    if (!user) return [];
    try {
      const dictCol = collection(this.firestore, `users/${user.uid}/dictionary`);
      const q = query(dictCol, orderBy('timestamp', 'desc'), limit(limitCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch (err) {
      console.error('[DictionaryService] Error fetching saved words:', err);
      return [];
    }
  }
```

In `migrateOldHistory()`, change the target doc (and the success alert text):
```ts
        const docRef = doc(this.firestore, `users/${user.uid}/dictionary`, word);
```
```ts
      alert(`Đã chuyển đổi thành công ${count} từ cũ sang từ điển của bạn!`);
```

- [ ] **Step 3: Edit `web/src/app/sub-app/dictionary/dictionary-ai.service.ts`**

Add imports:
```ts
import { Auth } from '@angular/fire/auth';
import { buildAuthHeaders } from '../../core/services/firebase-token';
```

Add field after `private firestore = inject(Firestore);`:
```ts
  private auth = inject(Auth);
```

In `lookupWord()`, replace the Firestore cache block:
```ts
    // Check Firestore cache (per-user dictionary/{word} collection)
    const user = this.auth.currentUser;
    if (user) {
      try {
        const normalizedWord = word.trim().toLowerCase();
        const docRef = doc(this.firestore, `users/${user.uid}/dictionary`, normalizedWord);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const firestoreData = docSnap.data() as DictionaryResult;
          this.cache.set(word, { data: firestoreData, cachedAt: Date.now() });
          return firestoreData;
        }
      } catch (err) {
        console.error('[DictionaryAiService] Firestore read error:', err);
      }
    }
```

In the "Save to Firestore" block, change the path:
```ts
    if (!result.error && user) {
      try {
        const normalizedWord = word.trim().toLowerCase();
        const docRef = doc(this.firestore, `users/${user.uid}/dictionary`, normalizedWord);
        await setDoc(docRef, { ...result, timestamp: serverTimestamp() });
      } catch (err) {
        console.error('[DictionaryAiService] Firestore write error:', err);
      }
    }
```

Replace `callApi()`:
```ts
  private async callApi(word: string): Promise<DictionaryResult> {
    try {
      const headers = await buildAuthHeaders(this.auth);
      const res = await fetch('/api/dictionary', {
        method: 'POST',
        headers,
        body: JSON.stringify({ word }),
      });
      if (!res.ok) {
        return { word, entries: [], collocations: [], error: 'Dictionary service unavailable. Please try again.' };
      }
      return await res.json();
    } catch (err) {
      return { word, entries: [], collocations: [], error: 'Failed to look up word. Please try again.' };
    }
  }
```

- [ ] **Step 4: Edit `web/src/app/core/services/chat.service.ts`**

Add imports:
```ts
import { Auth } from '@angular/fire/auth';
import { buildAuthHeaders } from './firebase-token';
```

Add field after `private http = inject(HttpClient);`:
```ts
  private auth = inject(Auth);
```

Replace `pushUserMessage()` (adds history trim so the client never exceeds the server cap of 100 messages):
```ts
  pushUserMessage(text: string) {
    const currentUi = this.messagesSubject.value;
    this.messagesSubject.next([...currentUi, { role: 'user', text }]);
    this.history.push({ role: 'user', parts: [{ text }] });
    if (this.history.length > 40) {
      this.history = this.history.slice(this.history.length - 40);
    }
  }
```

In `sendMessage()`, attach headers:
```ts
       const headers = await buildAuthHeaders(this.auth);
       const response = await firstValueFrom(
           this.http.post<{reply: string}>('/api/chat', { messages: this.history }, { headers })
       );
```

- [ ] **Step 5: Edit `web/src/app/features/think-aloud/services/speech.service.ts`**

Add imports:
```ts
import { Auth } from '@angular/fire/auth';
import { buildAuthHeaders } from '../../../core/services/firebase-token';
```

Add field after `private http = inject(HttpClient);`:
```ts
  private auth = inject(Auth);
```

In `speak()`, attach headers:
```ts
      const headers = await buildAuthHeaders(this.auth);
      const response = await firstValueFrom(
        this.http.post<{audio: string}>('/api/tts', { text }, { headers })
      );
```

- [ ] **Step 6: Edit `web/src/app/features/think-aloud/components/pattern-card/pattern-card.component.ts`**

Add imports (after the existing `@angular/common` import):
```ts
import { Auth } from '@angular/fire/auth';
import { buildAuthHeaders } from '../../../../core/services/firebase-token';
```

Add field after line 257 (`protected speech = inject(SpeechService);`):
```ts
  private auth = inject(Auth);
```

Replace `checkWithAI()`'s fetch call (fixes the pre-existing `content` vs `parts` bug AND adds auth):
```ts
      const headers = await buildAuthHeaders(this.auth);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [{
            role: 'user',
            parts: [{ text: `Check if the following sentence correctly follows the pattern "${card.pattern}". Pattern structure: "${card.structure}". Sentence: "${sentence}". Reply in JSON format: {"correct": boolean, "message": "short explanation in Vietnamese", "suggestion": "correction if any"}. Only return JSON.` }]
          }]
        })
      });
```

- [ ] **Step 7: Typecheck**

Run `npx tsc --noEmit -p tsconfig.app.json` in `web/` — expect zero errors (or only pre-existing unrelated errors; note them).

- [ ] **Step 8: Commit**

```bash
git add web/src/app/core/services/firebase-token.ts web/src/app/core/services/dictionary.service.ts web/src/app/sub-app/dictionary/dictionary-ai.service.ts web/src/app/core/services/chat.service.ts web/src/app/features/think-aloud/services/speech.service.ts web/src/app/features/think-aloud/components/pattern-card/pattern-card.component.ts
git commit -m "feat(security): attach Firebase ID tokens to api calls and scope dictionary to per-user"
```

---

### Task 7: Vercel + local dev proxy config

**Files:**
- Modify: `web/vercel.json`
- Create: `web/proxy.conf.json`
- Modify: `web/angular.json`

- [ ] **Step 1: Update `web/vercel.json`**

Replace with:
```json
{
  "rootDirectory": "web",
  "buildCommand": "npm run build",
  "outputDirectory": "dist/web/browser",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/((?!api/|.*\\.).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 2: Create `web/proxy.conf.json`**

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

- [ ] **Step 3: Wire proxyConfig into `web/angular.json`**

In the `serve` target, add an `options` block (sibling of `configurations`):
```json
        "serve": {
          "builder": "@angular-devkit/build-angular:dev-server",
          "options": {
            "proxyConfig": "proxy.conf.json"
          },
          "configurations": {
            "production": { "buildTarget": "web:build:production" },
            "development": { "buildTarget": "web:build:development" }
          },
          "defaultConfiguration": "development"
        },
```

- [ ] **Step 4: Commit**

```bash
git add web/vercel.json web/proxy.conf.json web/angular.json
git commit -m "fix(config): point Vercel at web/ root and add local dev api proxy"
```

---

### Task 8: Secret scanning, npm audit, CI

**Files:**
- Create: `package.json` (repo root)
- Create: `.husky/pre-commit`
- Modify: `.gitignore`
- Modify: `web/package.json` (audit scripts — done in Task 1, verify present)
- Create: `.github/workflows/security.yml`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "learning-english-tool",
  "private": true,
  "scripts": {
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.1.7"
  }
}
```

Run at repo root: `npm install` (creates root `package-lock.json` and runs `prepare` → husky). Husky 9 needs a git repo — this is one. It installs the hook dir. If `prepare` does not auto-create `.husky/_/husky.sh`, run `npx husky` once.

- [ ] **Step 2: Create `.husky/pre-commit`** (chmod +x)

```bash
#!/usr/bin/env sh
# Pre-commit secret scan: block commits that stage sensitive files or content.
. "$(dirname -- "$0")/_/husky.sh"

SECRET_PATTERNS='(\.env\b|\.env\.local|service-account|firebase-adminsdk|-sa\.json|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36,}|xox[bap]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})'

# 1) Filename scan over staged files
if git diff --cached --name-only --diff-filter=ACM | grep -qE "$SECRET_PATTERNS"; then
  echo "✖ SECRET BLOCKED: a staged file name matches a sensitive pattern:" >&2
  git diff --cached --name-only --diff-filter=ACM | grep -E "$SECRET_PATTERNS" >&2
  exit 1
fi

# 2) Content scan over staged text (allowlist the project's public Firebase web key)
STAGED_MATCHES=$(git grep --cached -nE "$SECRET_PATTERNS" -- . 2>/dev/null | grep -v 'AIzaSyD42z5IasZJwHDidl4pbgzv6vIzA3d2JdA' || true)
if [ -n "$STAGED_MATCHES" ]; then
  echo "✖ SECRET BLOCKED: staged content matches a sensitive pattern:" >&2
  printf '%s\n' "$STAGED_MATCHES" >&2
  exit 1
fi

exit 0
```

Then: `chmod +x .husky/pre-commit`

Test: `git add .gitignore && git commit -m "chore: test hook"` should pass; `printf 'AIzaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA secret\n' > /tmp/leak.txt && git add /tmp/leak.txt` in-repo should be blocked (create + stage a temp file, verify block, then remove it).

- [ ] **Step 3: Update `.gitignore`** — add `.firebaserc` under the Firebase section:
```
.firebaserc
```
(Verify existing entries already cover `.env*`, `*sa.json`, `firebase-adminsdk`.)

- [ ] **Step 4: Create `.github/workflows/security.yml`**

```yaml
name: Security Scan

on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  npm-audit:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci --ignore-scripts
      - run: npm audit --audit-level=high
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .husky/pre-commit .gitignore .github/workflows/security.yml web/package.json web/package-lock.json
git commit -m "chore(security): add pre-commit secret scanning, npm audit scripts, and CI security workflow"
```

---

### Task 9: Final verification

- [ ] **Step 1: Unit tests**

Run in `web/`: `npm run test:api` — expect all pass.

- [ ] **Step 2: Typecheck**

Run in `web/`: `npx tsc --noEmit -p tsconfig.app.json` — expect zero errors.

- [ ] **Step 3: Production build**

Run in `web/`: `npm run build` — expect success (Angular build with budgets).

- [ ] **Step 4: Frontend unit tests**

Run in `web/`: `npm run test` (Karma, headless Chrome if available) — if the environment cannot run a browser, note it and rely on build+typecheck.

- [ ] **Step 5: Rules compile**

Run `npx firebase-tools firestore:rules:compile --rules-file firestore.rules` in `web/` — expect no errors.

- [ ] **Step 6: Security diff audit (manual)**

Confirm with grep that across `web/api/*.js`:
- `grep -rn "apiKey.substring\|Calling Gemini\|Attempted to parse\|detail:" web/api/` → no matches
- every handler calls `authenticate(req)` and `checkRateLimit(...)` before processing
- `node --check` passes on all three handlers

- [ ] **Step 7: Final commit if any fixes were needed**

## Out of scope

- Deploying the rules to Firebase (requires `firebase login`; user-initiated) — rules are compiled locally, deployment left to the user.
- Adding `GEMINI_API_KEY`/`FIREBASE_PROJECT_ID` to Vercel env vars (Vercel dashboard; `GEMINI_API_KEY` presumably already set since prod works).
- Enabling Firebase App Check in the console (recommendation comment added to rules; console action is user-initiated).
- Migrating/backfilling existing shared `dictionary/{word}` documents into per-user paths (old shared docs become orphaned; `migrateOldHistory` covers the `users/{uid}/history` legacy path).

## Open questions

- Tooling change: `firebase-tools` 13.35.1 removed the `firestore:rules:compile` command (rules are validated at deploy time). Task 5 Step 1 substituted a structural validation script (brace/paren balance + required-construct grep) instead — all checks passed. Task 9 Step 5 should use the same substitution or `firebase deploy --only firestore:rules` (deploy is user-initiated, so local structural check only).
