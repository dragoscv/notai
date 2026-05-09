/**
 * Popup logic — v2. On open, peek at the active tab and pick a sensible
 * default mode (selection if the user highlighted text, otherwise article).
 * On save, build a payload for /api/clipper/v2 according to the mode and
 * stream it up (HTML for article, base64 PNG for screenshots, plain text
 * for selection).
 */

const $ = (sel) => document.querySelector(sel);
const titleEl = $('#title');
const bodyEl = $('#body');
const modeEl = $('#mode');
const statusEl = $('#status');
const includeUrlEl = $('#includeUrl');

let tabInfo = { id: 0, url: '', title: '', selection: '' };

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  tabInfo = { id: tab.id, url: tab.url ?? '', title: tab.title ?? '', selection: '' };
  titleEl.value = tab.title ?? '';
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = window.getSelection?.()?.toString() ?? '';
        if (sel.trim().length > 0) return { hasSelection: true, selection: sel };
        return { hasSelection: false };
      },
    });
    if (result?.hasSelection) {
      modeEl.value = 'selection';
      tabInfo.selection = result.selection;
      statusEl.textContent = `Captured selection (${result.selection.length} chars).`;
    } else {
      statusEl.textContent = 'Ready. Choose a mode and save.';
    }
  } catch {
    statusEl.textContent = "Couldn't inspect this tab. Pick a mode anyway.";
  }
})();

$('#cancel').addEventListener('click', () => window.close());

$('#open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    $('#save').click();
  }
});

async function captureArticleHTML(tabId) {
  // Grab full document HTML (after JS hydration). We inject a <base> so
  // Readability can resolve relative URLs on the server side.
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
  return result || '';
}

async function captureVisibleTab() {
  return await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
}

async function captureRegion(tabId) {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () =>
      new Promise((resolve) => {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
          position: 'fixed',
          inset: '0',
          zIndex: '2147483647',
          background: 'rgba(0,0,0,0.25)',
          cursor: 'crosshair',
        });
        const box = document.createElement('div');
        Object.assign(box.style, {
          position: 'fixed',
          border: '2px solid #f59e0b',
          background: 'rgba(245,158,11,0.10)',
          pointerEvents: 'none',
        });
        overlay.appendChild(box);
        const hint = document.createElement('div');
        Object.assign(hint.style, {
          position: 'fixed',
          left: '50%',
          top: '12px',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '6px 10px',
          borderRadius: '999px',
          font: '12px system-ui',
          pointerEvents: 'none',
        });
        hint.textContent = 'Drag to select a region — Esc to cancel';
        overlay.appendChild(hint);
        document.documentElement.appendChild(overlay);
        let sx = 0,
          sy = 0,
          ex = 0,
          ey = 0,
          dragging = false;
        const updateBox = () => {
          const x = Math.min(sx, ex);
          const y = Math.min(sy, ey);
          box.style.left = x + 'px';
          box.style.top = y + 'px';
          box.style.width = Math.abs(ex - sx) + 'px';
          box.style.height = Math.abs(ey - sy) + 'px';
        };
        const finish = (cancelled) => {
          window.removeEventListener('keydown', onKey, true);
          overlay.remove();
          if (cancelled) return resolve(null);
          const x = Math.min(sx, ex);
          const y = Math.min(sy, ey);
          const w = Math.abs(ex - sx);
          const h = Math.abs(ey - sy);
          if (w < 4 || h < 4) return resolve(null);
          resolve({ x, y, w, h, dpr: window.devicePixelRatio || 1 });
        };
        const onKey = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            finish(true);
          }
        };
        overlay.addEventListener('mousedown', (e) => {
          dragging = true;
          sx = e.clientX;
          sy = e.clientY;
          ex = sx;
          ey = sy;
          updateBox();
        });
        overlay.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          ex = e.clientX;
          ey = e.clientY;
          updateBox();
        });
        overlay.addEventListener('mouseup', () => {
          if (!dragging) return;
          finish(false);
        });
        window.addEventListener('keydown', onKey, true);
      }),
  });
  return result || null;
}

async function cropDataUrlToBase64Png(dataUrl, region) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('decode failed'));
    i.src = dataUrl;
  });
  const dpr = region.dpr || 1;
  const sx = Math.round(region.x * dpr);
  const sy = Math.round(region.y * dpr);
  const sw = Math.round(region.w * dpr);
  const sh = Math.round(region.h * dpr);
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buf = await blob.arrayBuffer();
  return arrayBufferToBase64(buf);
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function dataUrlToBase64(dataUrl) {
  const i = dataUrl.indexOf(',');
  return i === -1 ? dataUrl : dataUrl.slice(i + 1);
}

$('#save').addEventListener('click', async () => {
  const apiBase = (await chrome.storage.sync.get(['apiBase'])).apiBase || 'https://notai.ro';
  const token = (await chrome.storage.sync.get(['token'])).token;
  if (!token) {
    statusEl.textContent = 'Connect Notai first →';
    chrome.runtime.openOptionsPage();
    return;
  }
  const mode = modeEl.value;
  const url = includeUrlEl.checked ? tabInfo.url : '';
  $('#save').disabled = true;

  const payload = {
    title: titleEl.value || tabInfo.title || tabInfo.url,
    url,
    kind: mode,
    capturedAt: new Date().toISOString(),
  };

  try {
    if (mode === 'article') {
      statusEl.textContent = 'Reading article…';
      payload.html = await captureArticleHTML(tabInfo.id);
      if (!payload.html) throw new Error('Could not read page HTML');
    } else if (mode === 'selection') {
      const sel =
        tabInfo.selection ||
        (
          await chrome.scripting.executeScript({
            target: { tabId: tabInfo.id },
            func: () => window.getSelection?.()?.toString() ?? '',
          })
        )[0]?.result ||
        '';
      if (!sel.trim()) throw new Error('No text selected on this page');
      payload.selection = bodyEl.value ? `${bodyEl.value}\n\n${sel}` : sel;
    } else if (mode === 'page-screenshot') {
      statusEl.textContent = 'Capturing screen…';
      const dataUrl = await captureVisibleTab();
      payload.screenshotPngBase64 = dataUrlToBase64(dataUrl);
    } else if (mode === 'region-screenshot') {
      statusEl.textContent = 'Drag to select a region in the page…';
      const region = await captureRegion(tabInfo.id);
      if (!region) throw new Error('Cancelled');
      const dataUrl = await captureVisibleTab();
      payload.screenshotPngBase64 = await cropDataUrlToBase64Png(dataUrl, region);
    }
  } catch (err) {
    statusEl.textContent = `Capture failed: ${err.message}`;
    $('#save').disabled = false;
    return;
  }

  statusEl.textContent = 'Saving…';
  try {
    const res = await fetch(`${apiBase}/api/clipper/v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json().catch(() => ({}));
    const noteUrl = json?.url || (json?.id ? `${apiBase}/app/n/${json.id}` : '');
    statusEl.innerHTML = '';
    const ok = document.createElement('span');
    ok.textContent = '✓ Saved. ';
    statusEl.append(ok);
    if (noteUrl) {
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'Open note';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: noteUrl });
        window.close();
      });
      statusEl.append(link);
    }
    setTimeout(() => window.close(), 1400);
  } catch (err) {
    statusEl.textContent = `Save failed: ${err.message}`;
    $('#save').disabled = false;
  }
});
