/* ===== db.js — keeps songs on the phone (IndexedDB) + S.library (fast list) =====
   3 stores:  songs (info)  |  files (the audio itself)  |  covers (small pictures)  */
(function () {
  'use strict';
  const S = window.Saregaana;
  const NAME = 'saregaana', VER = 1;
  let db = null;
  const coverCache = new Map();               // song id -> picture URL (or null)

  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const finish = (t) => new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Saving was cancelled'));
  });

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(NAME, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
        if (!d.objectStoreNames.contains('covers')) d.createObjectStore('covers');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  /* ---------- S.library: the list lives in memory so screens are instant ---------- */
  const lib = { list: [], map: new Map() };

  function rebuild(songs) {
    lib.list = songs.sort((a, b) => b.added - a.added);
    lib.map = new Map(lib.list.map((s) => [s.id, s]));
  }

  // which era-station does a song belong to? (year comes from the song's own info)
  function inStation(song, id) {
    const y = song.year || 0;
    if (id === 'mix') return true;
    if (id === 'old') return y > 0 && y < 1990;
    if (id === 'nineties') return y >= 1990 && y <= 1999;
    if (id === 'romance') return y >= 2000 && y <= 2018;
    return false;
  }

  S.library = {
    get list() { return lib.list; },
    get(id) { return lib.map.get(id) || null; },
    hasSig(sig) { return lib.list.some((s) => s.sig === sig); },
    byStation(id) { return lib.list.filter((s) => inStation(s, id)); },
    count(id) { return lib.list.filter((s) => inStation(s, id)).length; }
  };

  /* ---------- S.db ---------- */
  S.db = {
    async init() {
      db = await open();
      const all = await req(db.transaction('songs').objectStore('songs').getAll());
      rebuild(all);
    },

    async addSong(meta, blob, cover) {
      const song = Object.assign({}, meta, { id: S.uid(), added: Date.now(), size: blob.size, hasCover: !!cover });
      const t = db.transaction(['songs', 'files', 'covers'], 'readwrite');
      t.objectStore('songs').put(song);
      t.objectStore('files').put(blob, song.id);
      if (cover) t.objectStore('covers').put(cover, song.id);
      await finish(t);
      lib.list.unshift(song);
      lib.map.set(song.id, song);
      return song;                              // caller emits 'library:changed' once after a batch
    },

    async updateSong(id, patch) {
      const song = Object.assign({}, lib.map.get(id), patch);
      const t = db.transaction('songs', 'readwrite');
      t.objectStore('songs').put(song);
      await finish(t);
      rebuild(lib.list.map((s) => (s.id === id ? song : s)));
      S.bus.emit('library:changed');
    },

    async removeSong(id) {
      const t = db.transaction(['songs', 'files', 'covers'], 'readwrite');
      t.objectStore('songs').delete(id);
      t.objectStore('files').delete(id);
      t.objectStore('covers').delete(id);
      await finish(t);
      const u = coverCache.get(id);
      if (u) URL.revokeObjectURL(u);
      coverCache.delete(id);
      rebuild(lib.list.filter((s) => s.id !== id));
      S.bus.emit('library:changed');
    },

    getBlob(id) { return req(db.transaction('files').objectStore('files').get(id)); },

    // returns a picture URL for a song, or null if it has none
    async coverURL(id) {
      if (coverCache.has(id)) return coverCache.get(id);
      const song = lib.map.get(id);
      if (!song || !song.hasCover) return null;
      const blob = await req(db.transaction('covers').objectStore('covers').get(id));
      const url = blob ? URL.createObjectURL(blob) : null;
      coverCache.set(id, url);
      return url;
    },

    async usage() {
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const e = await navigator.storage.estimate();
          return { used: e.usage || 0, quota: e.quota || 0 };
        }
      } catch (e) {}
      return { used: 0, quota: 0 };
    },

    // asks Android to keep the songs safe when the phone is low on space
    async persist() {
      try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); }
      catch (e) { return false; }
    }
  };
})();
