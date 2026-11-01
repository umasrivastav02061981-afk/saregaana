/* ===== posters.js — which picture shows for a song =====
   Order:  1. a poster you picked for the film  2. the picture inside the song file
           3. nothing -> the screen draws a retro poster in code
   Songs of the same film share one poster. */
(function () {
  'use strict';
  const S = window.Saregaana;
  const own = new Map();           // key -> picture URL (or null = none picked)
  const pending = new Map();

  const PAL = [
    { a: '#7c2d2a', b: '#e9d5a8', p1: '#8c2f2a', p2: '#d9892b' },
    { a: '#2f4a43', b: '#e8c474', p1: '#2f5a52', p2: '#e0b341' },
    { a: '#5a3a1c', b: '#f0e3c6', p1: '#6b3b1e', p2: '#d9a24a' },
    { a: '#2d3e5a', b: '#e9b8a0', p1: '#2d4a6b', p2: '#d9825a' },
    { a: '#4d5b2c', b: '#f0d9a0', p1: '#5d6b2a', p2: '#d9b64a' },
    { a: '#6b2a45', b: '#f2d3b0', p1: '#7a2b50', p2: '#e0905a' }
  ];

  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const keyOf = (song) => (norm(song.film) ? 'film:' + norm(song.film) : 'song:' + song.id);

  function hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }

  function loadImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('This picture cannot be read')); };
      img.src = url;
    });
  }

  // shrink big gallery photos so they do not eat phone storage
  async function resize(file, max) {
    const src = window.createImageBitmap ? await createImageBitmap(file) : await loadImage(file);
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not save the picture'))), 'image/jpeg', 0.86));
  }

  function ownUrl(key) {
    if (own.has(key)) return Promise.resolve(own.get(key));
    if (pending.has(key)) return pending.get(key);
    const p = (async () => {
      let url = null;
      try { const blob = await S.db.getPoster(key); if (blob) url = URL.createObjectURL(blob); } catch (e) {}
      own.set(key, url);
      pending.delete(key);
      return url;
    })();
    pending.set(key, p);
    return p;
  }

  function forget(key) {
    const old = own.get(key);
    if (old) URL.revokeObjectURL(old);
    own.delete(key);
  }

  S.posters = {
    keyOf,
    palette(seed) { return PAL[hash(String(seed)) % PAL.length]; },

    async url(song) {
      const mine = await ownUrl(keyOf(song));
      return mine || S.db.coverURL(song.id);
    },

    async set(song, file) {
      const blob = await resize(file, 640);
      const key = keyOf(song);
      await S.db.putPoster(key, blob);
      forget(key);
      S.bus.emit('library:changed');
    },

    async clear(song) {
      const key = keyOf(song);
      await S.db.deletePoster(key);
      forget(key);
      S.bus.emit('library:changed');
    }
  };
})();
