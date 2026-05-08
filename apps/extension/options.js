const apiBaseEl = document.querySelector('#apiBase');
const tokenEl = document.querySelector('#token');
const statusEl = document.querySelector('#status');

(async function init() {
  const stored = await chrome.storage.sync.get(['apiBase', 'token']);
  apiBaseEl.value = stored.apiBase || 'https://notai.ro';
  tokenEl.value = stored.token || '';
})();

document.querySelector('#save').addEventListener('click', async () => {
  const apiBase = apiBaseEl.value.trim().replace(/\/+$/, '');
  const token = tokenEl.value.trim();
  if (!apiBase || !token) {
    statusEl.textContent = 'Both fields are required.';
    return;
  }
  statusEl.textContent = 'Verifying…';
  try {
    const res = await fetch(`${apiBase}/api/clipper/whoami`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    await chrome.storage.sync.set({ apiBase, token });
    statusEl.textContent = `✓ Connected as ${json.email ?? 'your account'}.`;
  } catch (err) {
    statusEl.textContent = `Could not reach Notai: ${err.message}`;
  }
});
