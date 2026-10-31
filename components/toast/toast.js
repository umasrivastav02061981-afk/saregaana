/* ===== toast.js — Saregaana.toast('message') from anywhere ===== */
Saregaana.register('toast', (function () {
  'use strict';
  const S = window.Saregaana;
  let off = null, timer = 0;

  function init(mount) {
    const box = S.$('.toast-box', mount);
    off = S.bus.on('toast', (msg) => {
      box.textContent = msg;
      box.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => box.classList.remove('show'), 2600);
    });
  }

  function destroy() { if (off) off(); clearTimeout(timer); }

  return { init, destroy };
})());
