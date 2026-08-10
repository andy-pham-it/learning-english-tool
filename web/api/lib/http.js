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
