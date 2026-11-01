/* ===== app.js — starts the app and switches screens ===== */
(function () {
  'use strict';
  const S = window.Saregaana;
  const screenEl = document.getElementById('screen');

  // every screen name the app knows (unbuilt ones show "Coming soon")
  const ROUTES = ['radio', 'library', 'add', 'playlists', 'profile', 'settings', 'player', 'lyrics', 'stats'];
  let current = { name: null, api: null };
  let token = 0;                                       // stops old, slow loads from winning

  function routeFromHash() {
    const name = (location.hash || '').replace('#/', '');
    return ROUTES.includes(name) ? name : 'radio';
  }

  /* go to a screen (also gives the phone's Back button for free) */
  S.go = function (name) {
    if (!ROUTES.includes(name)) name = 'radio';
    if (location.hash !== '#/' + name) location.hash = '#/' + name;
  };

  async function show(name) {
    const mine = ++token;
    if (current.api && current.api.destroy) {
      try { current.api.destroy(); } catch (e) { S.log('destroy:' + current.name, e); }
    }
    current = { name: null, api: null };

    const wrap = document.createElement('div');
    wrap.className = 'screen-wrap';
    wrap.dataset.screen = name;
    screenEl.textContent = '';
    screenEl.appendChild(wrap);
    screenEl.scrollTop = 0;

    const api = await S.load('screens', name, wrap);
    if (mine !== token) { if (api && api.destroy) api.destroy(); return; }
    current = { name, api };
    S.bus.emit('route:change', name);
  }

  async function boot() {
    document.body.dataset.theme = S.store.get('theme', 'radio');

    // 1. the song database (if it fails, the app still opens, just with no songs)
    try { await S.db.init(); }
    catch (e) { S.log('db', e); }

    // 2. parts that live on every screen
    const holder = () => {                             // hidden box for components that only give templates
      const d = document.createElement('div');
      d.hidden = true;
      document.body.appendChild(d);
      return d;
    };
    await Promise.all([
      S.load('components', 'toast', document.getElementById('toast')),
      S.load('components', 'nav', document.getElementById('nav')),
      S.load('components', 'mini', document.getElementById('mini')),
      S.load('components', 'modal', document.getElementById('modal')),
      S.load('components', 'row', holder()),
      S.load('components', 'poster', holder())
    ]);
    try { S.player.restore(); } catch (e) { S.log('restore', e); }

    // 3. splash first, then the real home screen
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      document.body.classList.remove('booting');
      if (!location.hash) history.replaceState(null, '', '#/radio');
      window.addEventListener('hashchange', () => show(routeFromHash()));
      show(routeFromHash());
    };
    S.bus.on('splash:done', start);

    const wrap = document.createElement('div');
    wrap.className = 'screen-wrap';
    screenEl.appendChild(wrap);
    const api = await S.load('screens', 'splash', wrap);
    if (!api) start();                                 // splash missing/broken -> skip it
  }

  boot().catch((e) => S.log('boot', e));
})();
