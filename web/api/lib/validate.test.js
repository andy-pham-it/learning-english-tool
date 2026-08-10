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
