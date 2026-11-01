/* ===== loader.js — loads a section (html + css + js) safely =====
   S.load('screens', 'radio', mountElement)
   If a section is broken, only that section shows a message. The app keeps running.
   An empty section (files created but not written yet) shows "Coming soon". */
(function () {
  'use strict';
  const S = window.Saregaana;
  const registry = {};      // name -> { init, destroy }
  const cssDone = {};
  const jsDone = {};

  S.register = (name, api) => { registry[name] = api; };

  function loadCss(path) {
    if (cssDone[path]) return;
    cssDone[path] = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = path;
    document.head.appendChild(link);
  }

  function loadJs(path) {
    return new Promise((resolve, reject) => {
      if (jsDone[path]) return resolve();
      const s = document.createElement('script');
      s.src = path;
      s.onload = () => { jsDone[path] = true; resolve(); };
      s.onerror = () => reject(new Error('Cannot load ' + path));
      document.body.appendChild(s);
    });
  }

  async function fetchText(path) {
    const r = await fetch(path);
    if (!r.ok) { const e = new Error(path + ' (' + r.status + ')'); e.status = r.status; throw e; }
    return r.text();
  }

  function card(title, text, code, onRetry) {
    const box = document.createElement('div');
    box.className = 'sg-msg';
    const h = document.createElement('h3'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = text;
    box.append(h, p);
    if (code) {
      const c = document.createElement('p');
      const k = document.createElement('code');
      k.textContent = code; c.appendChild(k); box.appendChild(c);
    }
    if (onRetry) {
      const b = document.createElement('button');
      b.textContent = 'Retry'; b.onclick = onRetry; box.appendChild(b);
    }
    return box;
  }

  S.load = async function (kind, name, mount) {
    const base = kind + '/' + name + '/' + name;
    mount.textContent = '';
    try {
      const html = await fetchText(base + '.html');
      loadCss(base + '.css');
      await loadJs(base + '.js');
      const api = registry[name];

      if (!html.trim() && !api) {                      // files exist but are empty
        mount.appendChild(card('Coming soon', 'This part is not built yet · ' + name));
        return null;
      }
      mount.innerHTML = html;
      if (api && api.init) await api.init(mount);
      return api || null;

    } catch (e) {
      if (e.status === 404) {                          // folder/file not created yet
        mount.appendChild(card('Coming soon', 'This part is not built yet · ' + name, base + '.html'));
        return null;
      }
      S.log('load:' + name, e);
      mount.textContent = '';
      mount.appendChild(card('Section issue',
        'This section has an issue — the rest of the app still works.',
        name + ' — ' + e.message, () => S.load(kind, name, mount)));
      return null;
    }
  };
})();
