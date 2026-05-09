/**
 * Extension background (service worker) — v2. Routes context-menu and
 * keyboard-shortcut clips to /api/clipper/v2 with the right shape:
 *   - "Clip selection" → kind=selection
 *   - "Clip whole page" / Ctrl+Shift+S → kind=article (server runs Readability)
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'notai-clip-selection',
    title: 'Clip selection to Notai',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'notai-clip-page',
    title: 'Clip article to Notai',
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
      kind: 'selection',
      selection: info.selectionText,
    });
  } else if (info.menuItemId === 'notai-clip-page') {
    await clip({
      tabId: tab.id,
      url: info.pageUrl ?? tab.url ?? '',
      title: tab.title ?? '',
      kind: 'article',
    });
  }
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'clip-page') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await clip({ tabId: tab.id, url: tab.url ?? '', title: tab.title ?? '', kind: 'article' });
});

async function clip(input) {
  const { tabId, url, title, kind, selection } = input;
  const apiBase = (await chrome.storage.sync.get(['apiBase'])).apiBase || 'https://notai.ro';
  const token = (await chrome.storage.sync.get(['token'])).token;
  if (!token) {
    chrome.runtime.openOptionsPage();
    return;
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    title: title || url,
    url,
    kind,
    capturedAt: new Date().toISOString(),
  };
  try {
    if (kind === 'article') {
      const [{ result } = {}] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const doc = document.cloneNode(true);
          if (!doc.querySelector('base')) {
            const base = doc.createElement('base');
            base.href = location.href;
            const head = doc.querySelector('head');
            head?.insertBefore(base, head.firstChild);
          }
          return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
        },
      });
      payload.html = result || '';
      if (!payload.html) throw new Error('Could not read page HTML');
    } else if (kind === 'selection') {
      payload.selection = selection ?? '';
    }
  } catch (err) {
    notify('Notai capture failed', String(err.message || err));
    return;
  }

  try {
    const res = await fetch(`${apiBase}/api/clipper/v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Notai responded ${res.status}`);
    const json = await res.json().catch(() => ({}));
    const noteUrl = json?.url || (json?.id ? `${apiBase}/app/n/${json.id}` : '');
    notify('✓ Saved to Notai', payload.title, noteUrl);
  } catch (err) {
    notify('Notai clip failed', String(err.message || err));
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
