/* ===== row.js — S.row.create(song, options) gives one song row =====
   options: { onClick(song), onMore(song), onDelete(song) }
   S.row.watch(listElement)  -> highlights the playing song, returns a stop function */
Saregaana.register('row', (function () {
  'use strict';
  const S = window.Saregaana;
  let tpl = null;
  // paints a cover: your film poster / the picture in the file, else a record label made in code
  function paintCover(el, song) {
    const p = S.posters.palette(S.posters.keyOf(song));
    el.style.setProperty('--a', p.a);
    el.style.setProperty('--b', p.b);
    S.posters.url(song).then((u) => {
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
    li.addEventListener('click', (e) => { if (!e.target.closest('.row-del, .row-more')) act(); });
    li.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === li) { e.preventDefault(); act(); } });

    if (opt.onMore) {
      const more = li.querySelector('.row-more');
      more.hidden = false;
      more.addEventListener('click', () => opt.onMore(song));
    }
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
