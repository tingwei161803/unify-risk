// Calls to our own server. API keys stay on the server (see server.py), never here.

/** POST /api/<name> with a JSON body. Throws on any failure so the caller can fall back to demo data. */
export async function callApi(name, payload = {}) {
  const response = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API ${name} failed (${response.status})`);
  return data;
}
