/* ===== history.js — Saregaana listening history =====
   Tracks listening activity across every screen.
   Uses localStorage through S.store; no database migration.
*/
(function () {
  'use strict';

  const S = window.Saregaana;
  const KEY = 'listeningHistory';

  function emptyData() {
    return {
      version: 1,
      days: {},
      songs: {}
    };
  }

  let data = S.store.get(KEY, emptyData());

  if (!data || typeof data !== 'object' ||
      !data.days || !data.songs) {
    data = emptyData();
  }

  let activeSong = null;
  let playing = false;
  let lastPosition = null;
  let dirty = false;
  let lastSave = Date.now();

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function today() {
    return dateKey(new Date());
  }

  function getDay(key) {
    if (!data.days[key]) {
      data.days[key] = {
        seconds: 0,
        plays: 0
      };
    }

    return data.days[key];
  }

  function getSong(song) {
    if (!song || !song.id) return null;

    const id = String(song.id);

    if (!data.songs[id]) {
      data.songs[id] = {
        id: id,
        title: song.title || 'Unknown song',
        artist: song.artist || 'Unknown artist',
        seconds: 0,
        plays: 0,
        lastPlayed: 0
      };
    }

    const item = data.songs[id];

    item.title = song.title || item.title;
    item.artist = song.artist || item.artist;

    return item;
  }

  function save(force) {
    if (!dirty && !force) return;

    S.store.set(KEY, data);

    dirty = false;
    lastSave = Date.now();

    S.bus.emit('history:changed');
  }

  function markDirty() {
    dirty = true;

    if (Date.now() - lastSave >= 10000) {
      save(false);
    }
  }

  function onTrack(song) {
    activeSong = song && song.id ? song : null;
    lastPosition = null;
  }

  function onState(state) {
    const nextPlaying = !!(state && state.playing);

    if (nextPlaying && !playing && activeSong) {
      const item = getSong(activeSong);

      if (item) {
        const day = getDay(today());

        item.plays += 1;
        item.lastPlayed = Date.now();
        day.plays += 1;

        markDirty();
        save(false);
      }
    }

    playing = nextPlaying;

    if (!playing) {
      lastPosition = null;
    }
  }

  function onTime(info) {
    if (!playing || !activeSong || !info) return;

    const position = Number(info.pos);

    if (!Number.isFinite(position)) return;

    if (lastPosition !== null) {
      const delta = position - lastPosition;

      // Ignore seeking, track jumps and unusual playback gaps.
      if (delta > 0 && delta <= 3.5) {
        const item = getSong(activeSong);
        const day = getDay(today());

        if (item) {
          item.seconds += delta;
          day.seconds += delta;
          markDirty();
        }
      }
    }

    lastPosition = position;
  }

  S.bus.on('player:track', onTrack);
  S.bus.on('player:state', onState);
  S.bus.on('player:time', onTime);

  window.addEventListener('pagehide', function () {
    save(true);
  });

  S.history = {
    snapshot() {
      const days = Object.assign({}, data.days);

      const songs = Object.values(data.songs)
        .map(song => Object.assign({}, song));

      const totalSeconds = Object.values(days)
        .reduce((sum, day) => sum + (day.seconds || 0), 0);

      const totalPlays = Object.values(days)
        .reduce((sum, day) => sum + (day.plays || 0), 0);

      const daysListened = Object.values(days)
        .filter(day => (day.seconds || 0) > 0).length;

      const topSongs = songs
        .filter(song => song.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 10);

      const recentSongs = songs
        .filter(song => song.lastPlayed > 0)
        .sort((a, b) => b.lastPlayed - a.lastPlayed)
        .slice(0, 5);

      return {
        totalSeconds,
        totalPlays,
        daysListened,
        tracksPlayed: songs.filter(song => song.plays > 0).length,
        days,
        topSongs,
        recentSongs
      };
    },

    save() {
      save(true);
    }
  };

})();