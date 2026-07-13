// ── Shared state & API for writer_power_analysis static UI ──
const PLUGIN_ID = 'writer_power_analysis';
const RUNS_URL = '/runs';

// ── API ────────────────────────────────────────────────────
async function callPlugin(entry, args = {}, timeoutMs = 120000) {
  const body = JSON.stringify({ plugin_id: PLUGIN_ID, entry_id: entry, args });
  let resp;
  try {
    resp = await fetch(RUNS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (e) {
    console.error('[callPlugin] fetch POST failed:', e);
    throw new Error('网络请求失败: ' + e.message);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    console.error('[callPlugin] POST /runs', resp.status, text);
    throw new Error(`服务器返回 ${resp.status}`);
  }
  const json = await resp.json();
  console.log('[callPlugin] POST /runs for', entry, ':', json);
  const runId = json.run_id || json.id;
  if (!runId) {
    console.warn('[callPlugin] no run_id for', entry, ', treating as sync:', json);
    return unwrapResult(json);
  }

  const deadline = Date.now() + timeoutMs;
  let delay = 300;
  let pollCount = 0;
  while (Date.now() < deadline) {
    pollCount++;
    await sleep(delay);
    const poll = await fetch(`${RUNS_URL}/${runId}`).catch(() => null);
    if (!poll || !poll.ok) continue;
    const rec = await poll.json().catch(() => null);
    if (!rec) continue;
    if (['succeeded', 'failed', 'canceled', 'timeout'].includes(rec.status)) {
      console.log('[callPlugin] run', runId, 'status:', rec.status, 'entry:', entry, 'polls:', pollCount);
      if (rec.status !== 'succeeded') {
        throw new Error(rec.error?.message || rec.message || rec.status);
      }
      const exp = await fetch(`${RUNS_URL}/${runId}/export`).catch(() => null);
      if (!exp || !exp.ok) { console.warn('[callPlugin] export fetch failed for', entry); return {}; }
      const exported = await exp.json().catch(() => ({}));
      console.log('[callPlugin] export for', entry, ':', JSON.stringify(exported).substring(0, 300));
      const { items = [] } = exported;
      const item = items.find(i => i.type === 'json' && i.json) || items[0];
      if (!item) { console.warn('[callPlugin] no export items for', entry); return {}; }
      return unwrapResult(item.json || {});
    }
    delay = Math.min(delay * 1.5, 5000);
  }
  throw new Error('调用超时');
}

function unwrapResult(raw) {
  console.log('[callPlugin] unwrap input:', JSON.stringify(raw).substring(0, 300));
  // unwrap outer data nesting: {success: true, data: {...}} or {data: {success: true, ...}}
  while (raw && raw.data && typeof raw.data === 'object' && ('success' in raw.data || 'error' in raw.data || 'task_id' in raw.data)) {
    raw = raw.data;
  }
  // unwrap Ok/Err envelope: {success: true, result: {...}}
  if (raw && typeof raw === 'object' && raw.success === true && 'result' in raw) {
    console.log('[callPlugin] unwrap: Ok envelope, result keys:', Object.keys(raw.result || {}));
    return raw.result;
  }
  // unwrap {success: true, data: {...}} (no result field)
  if (raw && typeof raw === 'object' && raw.success === true && 'data' in raw) {
    console.log('[callPlugin] unwrap: Ok+data envelope, data keys:', Object.keys(raw.data || {}));
    return raw.data;
  }
  if (raw && typeof raw === 'object' && raw.success === false && raw.error) {
    throw new Error(raw.error);
  }
  // sometimes result is direct { result: {...} } without success wrapper
  // BUT only if the object has NO other metadata fields (task_id, status, etc.)
  if (raw && typeof raw === 'object' && 'result' in raw && !('success' in raw)
      && !('task_id' in raw) && !('status' in raw) && !('source' in raw)) {
    return raw.result;
  }
  return raw;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── State (localStorage-backed) ────────────────────────────
const LS = {
  get(key, fallback) {
    try { const v = localStorage.getItem('wpa_' + key); return v !== null ? JSON.parse(v) : fallback; }
    catch (_) { return fallback; }
  },
  set(key, val) { localStorage.setItem('wpa_' + key, JSON.stringify(val)); }
};

// ── Helpers ────────────────────────────────────────────────
function $q(sel, parent) { return (parent || document).querySelector(sel); }
function $qa(sel, parent) { return (parent || document).querySelectorAll(sel); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtDate(ts) { return new Date(ts).toLocaleString(); }

function scoreTone(score) {
  if (typeof score !== 'number') return 'default';
  if (score >= 80) return 'success';
  if (score >= 60) return 'primary';
  if (score >= 40) return 'warning';
  return 'danger';
}

const SCORE_CLASS = { success: 'badge-green', primary: 'badge-blue', warning: 'badge-yellow', danger: 'badge-red', default: 'badge-gray' };

// ── Notification ───────────────────────────────────────────
function notify(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast toast-' + type + ' show';
  setTimeout(() => el.className = 'toast', 2500);
}
