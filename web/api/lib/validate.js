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
