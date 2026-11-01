/* ===== mini.js — mini player (shows when a song is loaded) ===== */
Saregaana.register('mini', (function () {
  'use strict';
  const S = window.Saregaana;
  let offs = [];

  function init(mount) {
    const bar = S.$('#miniBar', mount);
    const cover = S.$('#miniCover', mount);
    const title = S.$('#miniTitle', mount);
    const sub = S.$('#miniSub', mount);
    const fill = S.$('#miniFill', mount);

    S.$('#miniOpen', mount).addEventListener('click', () => S.go('player'));
    S.$('#miniPlay', mount).addEventListener('click', () => S.player.toggle());
    S.$('#miniNext', mount).addEventListener('click', () => S.player.next(false));

    offs.push(S.bus.on('player:track', (song) => {
      if (!song) { bar.hidden = true; return; }
      bar.hidden = false;
      title.textContent = song.title;
      sub.textContent = [song.artist, song.film].filter(Boolean).join(' · ') || 'Unknown artist';
      cover.className = 'mini-cover row-cover fb';
      cover.style.backgroundImage = '';
      S.paintCover(cover, song);
    }));
    offs.push(S.bus.on('player:state', (st) => bar.classList.toggle('is-playing', st.playing)));
    offs.push(S.bus.on('player:time', (t) => { fill.style.width = (t.dur ? (t.pos / t.dur) * 100 : 0) + '%'; }));
    offs.push(S.bus.on('route:change', (name) => bar.classList.toggle('on-player', name === 'player')));
  }

  function destroy() { offs.forEach((f) => f()); offs = []; }

  return { init, destroy };
})());
