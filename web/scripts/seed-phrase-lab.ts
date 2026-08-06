import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SEED_CHUNKS, SEED_TEMPLATES } from './seed-data/phrase-seed.data';

const credentialPath = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
if (!credentialPath) {
  console.error('Missing GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON).');
  process.exit(1);
}

initializeApp({ credential: cert(credentialPath) });
const db = getFirestore();

async function seed<T extends { id: string }>(collectionName: string, docs: T[]): Promise<void> {
  const col = db.collection(collectionName);
  const batch = db.batch();
  for (const doc of docs) {
    batch.set(col.doc(doc.id), doc);
  }
  await batch.commit();
  console.log(`Seeded ${docs.length} docs into ${collectionName}`);
}

async function main(): Promise<void> {
  await seed('phrase_chunks', SEED_CHUNKS);
  await seed('phrase_templates', SEED_TEMPLATES);
  console.log('Done. Deploy firestore.rules before testing reads.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
