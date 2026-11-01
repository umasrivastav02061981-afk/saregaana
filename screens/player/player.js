/* ===== player.js (screen) — gramophone "now playing" ===== */
Saregaana.register('player', (function () {
  'use strict';
  const S = window.Saregaana;
  let root, el = {}, offs = [], seeking = false, qOpen = false, stopWatch = null;

  const ids = ['plRoot', 'plBack', 'plQBtn', 'plEmpty', 'plMain', 'plLabel', 'plTitle', 'plSub', 'plCur', 'plTot', 'plRange',
               'plShuffle', 'plPrev', 'plPlay', 'plNext', 'plRepeat', 'plQueue', 'plList'];

  function paintRange(v) { el.plRange.style.setProperty('--p', (v / 10) + '%'); }

  /* ---------- a new song started ---------- */
  function onTrack(song) {
    el.plEmpty.hidden = !!song;
    el.plMain.hidden = !song;
    el.plQBtn.hidden = !song;
    if (!song) { qOpen = false; el.plQueue.hidden = true; return; }

    el.plTitle.textContent = song.title;
    el.plSub.textContent = [song.artist, song.film, song.year || ''].filter(Boolean).join(' · ') || 'Unknown artist';
    el.plTot.textContent = song.duration ? S.fmtTime(song.duration) : '0:00';
    el.plLabel.className = 'pl-label fb';
    el.plLabel.style.backgroundImage = '';
    S.paintCover(el.plLabel, song);
    if (qOpen) renderQueue();
  }

  function onState(st) {
    el.plRoot.classList.toggle('is-playing', st.playing);
    el.plShuffle.setAttribute('aria-pressed', st.shuffle);
    el.plRepeat.setAttribute('aria-pressed', st.repeat !== 'off');
    el.plRepeat.dataset.mode = st.repeat;
  }

  function onTime(t) {
    if (seeking) return;
    const v = t.dur ? Math.round((t.pos / t.dur) * 1000) : 0;
    el.plRange.value = v;
    paintRange(v);
    el.plCur.textContent = S.fmtTime(t.pos);
    if (t.dur) el.plTot.textContent = S.fmtTime(t.dur);
  }

  /* ---------- up-next list ---------- */
  function renderQueue() {
    el.plList.textContent = '';
    if (stopWatch) stopWatch();
    const songs = S.player.queueSongs();
    songs.forEach((song, i) => el.plList.appendChild(S.row.create(song, { onClick: () => S.player.jump(i) })));
    stopWatch = S.row.watch(el.plList);
  }

  function init(mount) {
    root = mount; offs = []; seeking = false; qOpen = false;
    ids.forEach((id) => { el[id] = root.querySelector('#' + id); });

    el.plBack.addEventListener('click', () => { if (history.length > 1) history.back(); else S.go('radio'); });
    el.plQBtn.addEventListener('click', () => {
      qOpen = !qOpen;
      el.plQBtn.setAttribute('aria-pressed', qOpen);
      el.plQueue.hidden = !qOpen;
      if (qOpen) { renderQueue(); el.plQueue.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    S.$$('[data-go]', root).forEach((b) => b.addEventListener('click', () => S.go(b.dataset.go)));

    el.plPlay.addEventListener('click', () => S.player.toggle());
    el.plNext.addEventListener('click', () => S.player.next(false));
    el.plPrev.addEventListener('click', () => S.player.prev());
    el.plShuffle.addEventListener('click', () => S.player.setShuffle(!S.player.state().shuffle));
    el.plRepeat.addEventListener('click', () => S.player.cycleRepeat());

    // seek bar: drag to scrub, let go to jump
    el.plRange.addEventListener('input', () => {
      seeking = true;
      paintRange(el.plRange.value);
      const song = S.player.current();
      if (song && song.duration) el.plCur.textContent = S.fmtTime((el.plRange.value / 1000) * song.duration);
    });
    el.plRange.addEventListener('change', () => {
      const song = S.player.current();
      if (song && song.duration) S.player.seek((el.plRange.value / 1000) * song.duration);
      seeking = false;
    });

    offs.push(S.bus.on('player:track', onTrack));
    offs.push(S.bus.on('player:state', onState));
    offs.push(S.bus.on('player:time', onTime));

    // show what is already loaded
    onTrack(S.player.current());
    onState(S.player.state());
  }

  function destroy() {
    offs.forEach((f) => f()); offs = [];
    if (stopWatch) { stopWatch(); stopWatch = null; }
  }

  return { init, destroy };
})());
