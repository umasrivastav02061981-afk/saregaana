/* ===== utils.js — small helpers + error log (loads FIRST) ===== */
(function () {
  'use strict';
  const S = (window.Saregaana = window.Saregaana || {});

  /* ---- error log (Settings > Error log will show this) ---- */
  const KEY = 'sg:errors';
  S.errors = [];
  try { S.errors = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) {}

  S.log = function (where, err) {
    const item = { t: Date.now(), where: String(where), msg: String((err && err.message) || err) };
    S.errors.push(item);
    S.errors = S.errors.slice(-40);
    try { localStorage.setItem(KEY, JSON.stringify(S.errors)); } catch (e) {}
    console.error('[Saregaana]', where, err);
  };
  S.clearErrors = function () {
    S.errors = [];
    try { localStorage.removeItem(KEY); } catch (e) {}
  };

  /* ---- safe storage for small settings ---- */
  S.store = {
    get(k, fallback) {
      try { const v = localStorage.getItem('sg:' + k); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem('sg:' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('sg:' + k); } catch (e) {} }
  };

  /* ---- tiny helpers ---- */
  S.$ = (sel, root) => (root || document).querySelector(sel);
  S.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  S.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  S.buzz = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  S.toast = (msg) => { if (S.bus) S.bus.emit('toast', msg); };

  S.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };

  S.greeting = function () {
    const h = new Date().getHours();
    if (h < 5)  return { hi: 'शुभ रात्रि',  en: 'Late night tunes' };
    if (h < 12) return { hi: 'सुप्रभात',    en: 'Good morning' };
    if (h < 17) return { hi: 'नमस्ते',      en: 'Good afternoon' };
    if (h < 21) return { hi: 'शुभ संध्या',  en: 'Good evening' };
    return { hi: 'शुभ रात्रि', en: 'Good night' };
  };

  /* catch anything that slips through, so it shows in the Error log */
  window.addEventListener('error', (e) => S.log('window', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => S.log('promise', e.reason));
})();
