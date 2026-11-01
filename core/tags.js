/* ===== tags.js — reads song name, singer, film, year and picture from the file =====
   Works for mp3 (ID3 tags). Other formats fall back to the file name.
   Missing info can be edited later in the Library (Step 3). */
(function () {
  'use strict';
  const S = window.Saregaana;

  const dec = (enc, bytes) => { try { return new TextDecoder(enc).decode(bytes); } catch (e) { return ''; } };
  const syncsafe = (u, p) => ((u[p] & 0x7f) << 21) | ((u[p + 1] & 0x7f) << 14) | ((u[p + 2] & 0x7f) << 7) | (u[p + 3] & 0x7f);

  /* turn raw bytes into text (handles Hindi: UTF-16 / UTF-8) */
  function decodeText(bytes, enc) {
    let s;
    if (enc === 1) {
      if (bytes[0] === 0xFE && bytes[1] === 0xFF) s = dec('utf-16be', bytes.subarray(2));
      else if (bytes[0] === 0xFF && bytes[1] === 0xFE) s = dec('utf-16le', bytes.subarray(2));
      else s = dec('utf-16le', bytes);
    } else if (enc === 2) s = dec('utf-16be', bytes);
    else if (enc === 3) s = dec('utf-8', bytes);
    else {
      // "latin-1" tags often really hold UTF-8 Hindi. Try UTF-8 first.
      try { s = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { s = dec('windows-1252', bytes); }
    }
    return s.split('\u0000')[0].trim();
  }

  function parsePic(data, ver) {
    const enc = data[0];
    let p = 1;
    if (ver === 2) p += 3;                                   // 3-letter image type
    else { while (p < data.length && data[p] !== 0) p++; p++; }   // mime text
    const type = data[p]; p++;
    if (enc === 1 || enc === 2) { while (p + 1 < data.length && !(data[p] === 0 && data[p + 1] === 0)) p += 2; p += 2; }
    else { while (p < data.length && data[p] !== 0) p++; p++; }
    const img = data.subarray(p);
    if (img.length < 100) return null;
    const mime = img[0] === 0xFF && img[1] === 0xD8 ? 'image/jpeg'
      : img[0] === 0x89 && img[1] === 0x50 ? 'image/png'
      : img[0] === 0x47 ? 'image/gif' : 'image/jpeg';
    return { type, blob: new Blob([img.slice()], { type: mime }) };
  }

  function parseId3v2(buf) {
    const u = new Uint8Array(buf);
    const v = new DataView(buf);
    const ver = u[3];
    const out = { title: '', artist: '', film: '', year: '', cover: null };
    if (ver < 2 || ver > 4) return out;

    const end = Math.min(buf.byteLength, 10 + syncsafe(u, 6));
    let pos = 10;
    if (u[5] & 0x40) {                                        // skip extended header
      const sz = ver === 4 ? syncsafe(u, pos) : v.getUint32(pos);
      pos += ver === 4 ? sz : sz + 4;
    }
    const idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
    let bestPic = null;

    while (pos + hdr <= end) {
      const id = String.fromCharCode.apply(null, u.subarray(pos, pos + idLen));
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      let size;
      if (ver === 2) size = (u[pos + 3] << 16) | (u[pos + 4] << 8) | u[pos + 5];
      else if (ver === 4) size = syncsafe(u, pos + 4);
      else size = v.getUint32(pos + 4);
      const start = pos + hdr;
      if (size <= 0 || start + size > buf.byteLength) break;
      const data = u.subarray(start, start + size);

      const text = () => decodeText(data.subarray(1), data[0]);
      switch (id) {
        case 'TIT2': case 'TT2': out.title = text(); break;
        case 'TPE1': case 'TP1': out.artist = text(); break;
        case 'TPE2': case 'TP2': if (!out.artist) out.artist = text(); break;
        case 'TALB': case 'TAL': out.film = text(); break;
        case 'TYER': case 'TYE': case 'TDRC': if (!out.year) out.year = text(); break;
        case 'APIC': case 'PIC': {
          const pic = parsePic(data, ver);
          if (pic && (!bestPic || pic.type === 3)) bestPic = pic;
          break;
        }
        default: break;
      }
      pos = start + size;
    }
    if (bestPic) out.cover = bestPic.blob;
    return out;
  }

  function parseId3v1(buf) {
    const u = new Uint8Array(buf);
    if (u.length < 128) return null;
    const o = u.length - 128;
    if (String.fromCharCode(u[o], u[o + 1], u[o + 2]) !== 'TAG') return null;
    const f = (a, b) => dec('windows-1252', u.subarray(o + a, o + b)).replace(/\u0000[\s\S]*$/, '').trim();
    return { title: f(3, 33), artist: f(33, 63), film: f(63, 93), year: f(93, 97) };
  }

  /* "03_Tum_Hi_Ho_(MyMp3Song.Com).mp3"  ->  "Tum Hi Ho" */
  function cleanName(name) {
    let s = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
    s = s.replace(/\s*[\(\[][^\)\]]*\.(com|in|net|org|co)[^\)\]]*[\)\]]/ig, '');
    s = s.replace(/^\d{1,3}[\s.\-]+/, '').replace(/\s+/g, ' ').trim();
    return s || name;
  }

  function duration(file) {
    return new Promise((resolve) => {
      const a = new Audio();
      const url = URL.createObjectURL(file);
      let done = false;
      const end = (d) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(d); };
      a.preload = 'metadata';
      a.onloadedmetadata = () => end(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => end(0);
      setTimeout(() => end(0), 6000);
      a.src = url;
    });
  }

  async function read(file) {
    let m = { title: '', artist: '', film: '', year: '', cover: null };
    try {
      const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {           // "ID3"
        const size = Math.min(syncsafe(head, 6) + 10, 8 * 1024 * 1024);
        m = parseId3v2(await file.slice(0, size).arrayBuffer());
      }
      if (!m.title) {
        const v1 = parseId3v1(await file.slice(-128).arrayBuffer());
        if (v1) m = Object.assign(m, v1, { cover: m.cover });
      }
    } catch (e) { S.log('tags:' + file.name, e); }

    const year = parseInt((String(m.year).match(/\d{4}/) || [0])[0], 10) || 0;
    return {
      title: m.title || cleanName(file.name),
      artist: m.artist || '',
      film: m.film || '',
      year,
      cover: m.cover || null,
      duration: await duration(file)
    };
  }

  /* read a .lrc / .txt file as text (UTF-8, UTF-16 or old Windows text) */
  async function readText(file) {
    const b = new Uint8Array(await file.arrayBuffer());
    if (b[0] === 0xFF && b[1] === 0xFE) return dec('utf-16le', b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return dec('utf-16be', b.subarray(2));
    const start = (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) ? 3 : 0;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(start)); }
    catch (e) { return dec('windows-1252', b.subarray(start)); }
  }

  S.tags = { read, readText, _parseId3v2: parseId3v2, _clean: cleanName };
})();
