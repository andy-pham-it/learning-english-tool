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
