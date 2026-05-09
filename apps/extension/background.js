/**
 * Extension background (service worker). Handles:
 *   - the toolbar icon → opens the popup (default behaviour)
 *   - keyboard shortcut → captures + sends straight to Notai
 *   - context menu "Clip selection to Notai" → captures the selection
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'notai-clip-selection',
    title: 'Clip selection to Notai',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'notai-clip-page',
    title: 'Clip whole page to Notai',
    contexts: ['page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'notai-clip-selection' && info.selectionText) {
    await clip({
      tabId: tab.id,
      url: info.pageUrl ?? tab.url ?? '',
      title: tab.title ?? '',
      mode: 'selection',
      selection: info.selectionText,
    });
  } else if (info.menuItemId === 'notai-clip-page') {
    await clip({
      tabId: tab.id,
      url: info.pageUrl ?? tab.url ?? '',
      title: tab.title ?? '',
      mode: 'page',
    });
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'clip-page') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await clip({
    tabId: tab.id,
    url: tab.url ?? '',
    title: tab.title ?? '',
    mode: 'page',
  });
});

async function clip(input) {
  const { tabId, url, title, mode, selection } = input;
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractContent,
    args: [mode],
  });
  const body = mode === 'selection' && selection ? selection : result?.text ?? '';
  const headline = result?.title || title || url;

  const apiBase = (await chrome.storage.sync.get(['apiBase'])).apiBase || 'https://notai.ro';
  const token = (await chrome.storage.sync.get(['token'])).token;
  if (!token) {
    chrome.runtime.openOptionsPage();
    return;
  }

  try {
    const res = await fetch(`${apiBase}/api/clipper`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: headline,
        url,
        body,
        capturedAt: new Date().toISOString(),
        kind: mode,
      }),
    });
    if (!res.ok) throw new Error(`Notai responded ${res.status}`);
    const json = await res.json().catch(() => ({}));
    const noteUrl = json?.url || (json?.id ? `${apiBase}/app/n/${json.id}` : '');
    notify('✓ Saved to Notai', headline, noteUrl);
  } catch (err) {
    notify('Notai clip failed', String(err));
  }
}

const notificationLinks = new Map();

function notify(title, message, openUrl) {
  if (!chrome.notifications) return;
  chrome.notifications.create(
    {
      type: 'basic',
      title,
      message,
      iconUrl: 'icons/icon-128.png',
    },
    (id) => {
      if (id && openUrl) notificationLinks.set(id, openUrl);
    },
  );
}

chrome.notifications?.onClicked.addListener((id) => {
  const url = notificationLinks.get(id);
  if (url) {
    chrome.tabs.create({ url });
    notificationLinks.delete(id);
  }
  chrome.notifications.clear(id);
});

/** Runs in the page; gathers a sensible plaintext snapshot. */
function extractContent(mode) {
  if (mode === 'selection') {
    const sel = window.getSelection?.()?.toString() ?? '';
    return { title: document.title, text: sel };
  }
  // Cheap heuristic: prefer <article>, fall back to <main>, fall back to body.
  const root =
    document.querySelector('article') ??
    document.querySelector('main') ??
    document.body;
  const clone = root.cloneNode(true);
  for (const sel of ['script', 'style', 'noscript', 'nav', 'aside', 'header', 'footer', 'form']) {
    clone.querySelectorAll(sel).forEach((n) => n.remove());
  }
  const text = clone.textContent?.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() ?? '';
  return { title: document.title, text: text.slice(0, 30000) };
}
