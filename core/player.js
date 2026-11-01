/* ===== player.js — the audio engine (play, queue, shuffle, repeat, lock-screen) =====
   Other sections talk to it with messages:
     Saregaana.bus.emit('song:play', { ids: [...], index: 0 })
     Saregaana.bus.emit('station:play', station)
   and listen to:  'player:track'  'player:state'  'player:time'                 */
(function () {
  'use strict';
  const S = window.Saregaana;
  const audio = new Audio();
  audio.preload = 'auto';

  let orig = [], queue = [], idx = -1;          // orig = normal order, queue = order being played
  let url = null, shuffle = false, repeat = 'off';       // repeat: off | all | one
  let loadToken = 0, errors = 0, resumePos = 0, lastSave = 0;

  const emit = (ev, d) => S.bus.emit(ev, d);
  const current = () => (idx >= 0 && queue[idx] ? S.library.get(queue[idx]) : null);
  const snap = () => ({ playing: !audio.paused, shuffle, repeat, index: idx, count: queue.length, song: current() });

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function reshuffleKeepingCurrent() {
    const cur = queue[idx];
    queue = [cur].concat(shuffled(orig.filter((id) => id !== cur)));
    idx = 0;
  }

  function sync() {
    const st = snap();
    document.body.classList.toggle('sg-playing', st.playing);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = st.playing ? 'playing' : 'paused';
    emit('player:state', st);
  }

  async function setMedia(song) {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    try {
      const u = await S.db.coverURL(song.id);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title, artist: song.artist || 'Saregaana', album: song.film || 'Saregaana',
        artwork: u ? [{ src: u, sizes: '512x512' }] : []
      });
    } catch (e) {}
  }

  async function load(autoplay) {
    const my = ++loadToken;
    const song = current();
    if (!song) return;
    try {
      const blob = await S.db.getBlob(song.id);
      if (my !== loadToken) return;
      if (!blob) throw new Error('Song file is missing');
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      audio.src = url;
      emit('player:track', song);
      setMedia(song);
      S.store.set('last', { id: song.id, pos: 0 });
      if (autoplay) await audio.play();
    } catch (e) {
      if (e && e.name === 'NotAllowedError') { S.toast('Tap play to start'); sync(); return; }
      S.log('player', e);
      S.toast('Cannot play this song');
    }
  }

  function next(auto) {
    if (!queue.length) return;
    if (auto && repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    if (idx + 1 < queue.length) { idx++; return load(true); }
    if (repeat === 'all' || !auto) { idx = 0; return load(true); }
    audio.pause(); audio.currentTime = 0; sync();                       // end of the queue
  }

  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (idx > 0) idx--; else idx = repeat === 'all' ? queue.length - 1 : 0;
    return load(true);
  }

  function toggle() {
    if (!current()) {
      const ids = S.library.list.map((s) => s.id);
      if (!ids.length) { S.toast('Add songs first'); return; }
      return S.player.play(ids, 0);
    }
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }

  S.player = {
    play(ids, start, opt) {
      if (!ids || !ids.length) return;
      orig = ids.slice();
      queue = ids.slice();
      idx = Math.max(0, Math.min(start || 0, queue.length - 1));
      if (opt && opt.shuffleOnce) { queue = shuffled(queue); idx = 0; }      // "radio" feel
      else if (shuffle) reshuffleKeepingCurrent();
      errors = 0;
      return load(true);
    },
    toggle, next, prev,
    seek(sec) { if (isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(sec, audio.duration)); },
    jump(i) { if (i >= 0 && i < queue.length) { idx = i; return load(true); } },
    setShuffle(on) {
      shuffle = !!on;
      if (queue.length) {
        const cur = queue[idx];
        if (shuffle) reshuffleKeepingCurrent(); else { queue = orig.slice(); idx = Math.max(0, queue.indexOf(cur)); }
      }
      sync();
    },
    cycleRepeat() { repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off'; sync(); },
    current, state: snap,
    queueSongs() { return queue.map((id) => S.library.get(id)).filter(Boolean); },

    // after the app opens: show the last song in the mini player (paused)
    restore() {
      const last = S.store.get('last', null);
      if (!last || !S.library.get(last.id)) return;
      orig = S.library.list.map((s) => s.id);
      queue = orig.slice();
      idx = queue.indexOf(last.id);
      resumePos = last.pos || 0;
      load(false);
    }
  };

  /* ---------- audio element events ---------- */
  audio.addEventListener('play', () => { errors = 0; sync(); });
  audio.addEventListener('pause', sync);
  audio.addEventListener('ended', () => next(true));
  audio.addEventListener('loadedmetadata', () => {
    if (resumePos) { try { audio.currentTime = resumePos; } catch (e) {} resumePos = 0; }
    emit('player:time', { pos: audio.currentTime, dur: audio.duration || 0 });
  });
  audio.addEventListener('timeupdate', () => {
    const dur = audio.duration || 0;
    emit('player:time', { pos: audio.currentTime, dur });
    const now = Date.now();
    if (now - lastSave > 4000 && current()) { lastSave = now; S.store.set('last', { id: current().id, pos: audio.currentTime }); }
    if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && isFinite(dur) && dur > 0) {
      try { navigator.mediaSession.setPositionState({ duration: dur, position: Math.min(audio.currentTime, dur), playbackRate: 1 }); } catch (e) {}
    }
  });
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    errors++;
    S.log('audio', (audio.error && audio.error.message) || 'cannot decode this file');
    S.toast('Cannot play this song');
    if (errors < 3) next(true);
  });

  /* ---------- lock-screen / headset buttons ---------- */
  if ('mediaSession' in navigator) {
    const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch (e) {} };
    set('play', () => audio.play().catch(() => {}));
    set('pause', () => audio.pause());
    set('previoustrack', () => prev());
    set('nexttrack', () => next(false));
    set('seekto', (d) => { if (d && typeof d.seekTime === 'number') S.player.seek(d.seekTime); });
  }

  /* ---------- messages from other sections ---------- */
  S.bus.on('song:play', (d) => { if (d) S.player.play(d.ids, d.index || 0); });
  S.bus.on('station:play', (st) => {
    const ids = S.library.byStation(st.id).map((s) => s.id);
    if (ids.length) S.player.play(ids, 0, { shuffleOnce: true });
  });
  S.bus.on('library:changed', () => {
    if (!queue.length) return;
    const curId = queue[idx];
    const has = (id) => !!S.library.get(id);
    orig = orig.filter(has);
    queue = queue.filter(has);
    if (!has(curId)) {                                   // the playing song was deleted
      audio.pause(); audio.removeAttribute('src'); audio.load();
      idx = -1; queue = []; orig = [];
      S.store.del('last');
      emit('player:track', null);
      sync();
    } else {
      idx = queue.indexOf(curId);
    }
  });
})();
