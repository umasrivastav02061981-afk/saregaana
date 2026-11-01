/* ===== row.js — S.row.create(song, options) gives one song row =====
   options: { onClick(song), onDelete(song) }
   S.row.watch(listElement)  -> highlights the playing song, returns a stop function */
Saregaana.register('row', (function () {
  'use strict';
  const S = window.Saregaana;
  let tpl = null;
  const PALETTE = [['#7c2d2a', '#e9d5a8'], ['#2f4a43', '#e8c474'], ['#5a3a1c', '#f0e3c6'],
                   ['#2d3e5a', '#e9b8a0'], ['#4d5b2c', '#f0d9a0'], ['#6b2a45', '#f2d3b0']];

  function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }

  // paints a cover (real picture if the song has one, otherwise a record label)
  function paintCover(el, song) {
    const p = PALETTE[hash(song.id) % PALETTE.length];
    el.style.setProperty('--a', p[0]);
    el.style.setProperty('--b', p[1]);
    S.db.coverURL(song.id).then((u) => {
      if (u) { el.classList.remove('fb'); el.style.backgroundImage = 'url("' + u + '")'; }
    }).catch(() => {});
  }
  S.paintCover = paintCover;                              // mini player and player screen reuse it

  function create(song, opt) {
    opt = opt || {};
    const li = tpl.content.firstElementChild.cloneNode(true);
    li.dataset.id = song.id;
    li.querySelector('.row-title').textContent = song.title;
    li.querySelector('.row-sub').textContent = [song.artist, song.film, song.year || ''].filter(Boolean).join(' · ') || 'Unknown artist';
    li.querySelector('.row-dur').textContent = song.duration ? S.fmtTime(song.duration) : '';
    paintCover(li.querySelector('.row-cover'), song);

    const act = () => { if (opt.onClick) opt.onClick(song); };
    li.addEventListener('click', (e) => { if (!e.target.closest('.row-del')) act(); });
    li.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === li) { e.preventDefault(); act(); } });

    if (opt.onDelete) {
      const del = li.querySelector('.row-del');
      del.hidden = false;
      del.addEventListener('click', () => opt.onDelete(song));
    }
    const cur = S.player.current();
    if (cur && cur.id === song.id) li.classList.add('is-current');
    return li;
  }

  function watch(list) {
    const mark = (song) => {
      const id = song ? song.id : null;
      list.querySelectorAll('.row').forEach((r) => r.classList.toggle('is-current', r.dataset.id === id));
    };
    return S.bus.on('player:track', mark);
  }

  function init(mount) {
    tpl = mount.querySelector('template');
    S.row = { create, watch };
  }

  return { init };
})());
