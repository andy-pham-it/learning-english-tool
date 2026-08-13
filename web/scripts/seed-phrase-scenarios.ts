import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SEED_CHUNKS } from './seed-data/phrase-seed.data';
import { SEED_SCENARIOS } from './seed-data/scenario-seed.data';
import type { Scenario } from '../src/app/sub-app/phrase-lab/models/scenario.model';

const credentialPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
if (!credentialPath) {
  console.error('Missing GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON).');
  process.exit(1);
}

initializeApp({ credential: cert(credentialPath) });
const db = getFirestore();

const BATCH_MAX = 400; // Firestore giới hạn 500 ops/batch

function verifyChunkIds(): void {
  const known = new Set(SEED_CHUNKS.map((c) => c.id));
  const referenced = [...new Set(SEED_SCENARIOS.flatMap((s) => s.turns.flatMap((t) => t.answers.flat())))];
  const missing = referenced.filter((id) => !known.has(id));
  if (missing.length > 0) {
    console.error(`Missing chunk IDs in SEED_CHUNKS: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`Verified ${referenced.length} referenced chunk IDs.`);
}

async function seedChunked(collectionName: string, docs: Array<{ id: string }>): Promise<void> {
  const col = db.collection(collectionName);
  for (let i = 0; i < docs.length; i += BATCH_MAX) {
    const batch = db.batch();
    const slice = docs.slice(i, i + BATCH_MAX);
    for (const d of slice) batch.set(col.doc(d.id), d);
    await batch.commit();
    console.log(`Seeded ${slice.length} docs (${i + slice.length}/${docs.length}) into ${collectionName}`);
  }
}

async function main(): Promise<void> {
  verifyChunkIds();
  if (SEED_SCENARIOS.length < 20) {
    console.error(`Need at least 20 scenarios, got ${SEED_SCENARIOS.length}.`);
    process.exit(1);
  }
  await seedChunked('phrase_scenarios', SEED_SCENARIOS as unknown as Array<{ id: string }>);
  await db.collection('phrase_scenarios').doc('meta').set({ version: Date.now() });
  console.log(`Done. Seeded ${SEED_SCENARIOS.length} scenarios + meta version.`);
  console.log('Deploy firestore.rules before testing reads.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
