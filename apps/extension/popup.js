/**
 * Popup logic. On open: read the active tab, ask the content script for a
 * plaintext snapshot, populate fields. On save: POST to /api/clipper.
 */

const $ = (sel) => document.querySelector(sel);
const titleEl = $('#title');
const bodyEl = $('#body');
const modeEl = $('#mode');
const statusEl = $('#status');
const includeUrlEl = $('#includeUrl');

let tabInfo = { url: '', title: '' };

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  tabInfo = { url: tab.url ?? '', title: tab.title ?? '' };
  titleEl.value = tab.title ?? '';
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = window.getSelection?.()?.toString() ?? '';
        if (sel.trim().length > 0) return { mode: 'selection', text: sel };
        const root =
          document.querySelector('article') ??
          document.querySelector('main') ??
          document.body;
        return { mode: 'page', text: (root.textContent ?? '').slice(0, 6000) };
      },
    });
    if (result) {
      modeEl.value = result.mode;
      bodyEl.value = result.text.trim();
      statusEl.textContent =
        result.mode === 'selection'
          ? 'Captured your text selection.'
          : 'Captured the page content.';
    }
  } catch (err) {
    statusEl.textContent = "Couldn't read this tab.";
  }
})();

$('#cancel').addEventListener('click', () => window.close());

$('#open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

$('#save').addEventListener('click', async () => {
  const apiBase = (await chrome.storage.sync.get(['apiBase'])).apiBase || 'https://notai.ro';
  const token = (await chrome.storage.sync.get(['token'])).token;
  if (!token) {
    statusEl.textContent = 'Connect Notai first →';
    chrome.runtime.openOptionsPage();
    return;
  }
  const mode = modeEl.value;
  const body = mode === 'empty' ? '' : bodyEl.value;
  const payload = {
    title: titleEl.value || tabInfo.title || tabInfo.url,
    url: includeUrlEl.checked ? tabInfo.url : '',
    body,
    capturedAt: new Date().toISOString(),
    kind: mode,
  };
  statusEl.textContent = 'Saving…';
  try {
    const res = await fetch(`${apiBase}/api/clipper`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    statusEl.textContent = '✓ Saved.';
    setTimeout(() => window.close(), 600);
  } catch (err) {
    statusEl.textContent = `Save failed: ${err.message}`;
  }
});
