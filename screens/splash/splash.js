/* ===== splash.js — shows the intro, then tells the app it is done ===== */
Saregaana.register('splash', (function () {
  'use strict';
  const S = window.Saregaana;
  let timer = 0, done = false, root = null, onTap = null;

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    S.bus.emit('splash:done');
  }

  function init(mount) {
    root = mount;
    done = false;
    onTap = finish;
    root.addEventListener('click', onTap);   // tap anywhere to skip
    timer = setTimeout(finish, 2400);
  }

  function destroy() {
    clearTimeout(timer);
    if (root && onTap) root.removeEventListener('click', onTap);
  }

  return { init, destroy };
})());
