/* ===== nav.js — bottom navigation ===== */
Saregaana.register('nav', (function () {
  'use strict';
  const S = window.Saregaana;
  let off = null;

  function init(mount) {
    const btns = S.$$('.nav-btn', mount);

    btns.forEach((b) => b.addEventListener('click', () => {
      S.buzz(8);
      S.go(b.dataset.go);
    }));

    // highlight the tab of the screen that is open
    off = S.bus.on('route:change', (name) => {
      btns.forEach((b) => {
        const on = b.dataset.go === name;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
    });
  }

  function destroy() { if (off) off(); }

  return { init, destroy };
})());
