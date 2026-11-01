/* ===== poster.js — S.poster.create({ title, sub, year, song, onClick, big }) ===== */
Saregaana.register('poster', (function () {
  'use strict';
  const S = window.Saregaana;
  let tpl = null;

  function create(o) {
    const el = tpl.content.firstElementChild.cloneNode(true);
    const art = el.querySelector('.pc-art');
    const p = S.posters.palette(S.posters.keyOf(o.song));
    art.style.setProperty('--p1', p.p1);
    art.style.setProperty('--p2', p.p2);

    el.querySelector('.pc-title').textContent = o.title || '';
    el.querySelector('.pc-year').textContent = o.year || '';
    el.querySelector('.pc-name').textContent = o.title || '';
    el.querySelector('.pc-sub').textContent = o.sub || '';
    if (o.big) el.classList.add('big');
    if (o.onClick) el.addEventListener('click', o.onClick);

    S.posters.url(o.song).then((u) => {
      if (u) { art.classList.remove('fb'); art.style.backgroundImage = 'url("' + u + '")'; }
    }).catch(() => {});
    return el;
  }

  function init(mount) {
    tpl = mount.querySelector('template');
    S.poster = { create };
  }

  return { init };
})());
