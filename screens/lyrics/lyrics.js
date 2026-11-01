/* ===== lyrics.js — lyrics for the playing song (.lrc scrolls in time, .txt is plain) ===== */
Saregaana.register('lyrics', (function () {
  'use strict';
  const S = window.Saregaana;
  let root, el = {}, offs = [], scroller = null;
  let song = null, lines = [], synced = false, active = -1, pauseUntil = 0, token = 0, hasText = false;

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* [mm:ss.xx] text   (also handles several stamps per line and [offset:+300]) */
  function parse(text) {
    const out = [];
    let offset = 0;
    String(text).split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      const off = /^\[offset:\s*([+-]?\d+)\]/i.exec(line);
      if (off) { offset = parseInt(off[1], 10) / 1000; return; }
      const stamps = Array.from(line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g));
      if (!stamps.length) return;
      const txt = line.replace(/\[[^\]]*\]/g, '').trim();
      stamps.forEach((m) => {
        const frac = m[3] ? parseInt(m[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
        out.push({ t: Math.max(0, parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac + offset), text: txt });
      });
    });
    return out.sort((a, b) => a.t - b.t);
  }

  /* ---------- show lyrics ---------- */
  function showEmpty(title, text, withButtons) {
    el.lyBody.textContent = '';
    el.lyBody.className = 'ly-body';
    el.lyEmpty.hidden = false;
    el.lyEmptyT.textContent = title;
    el.lyEmptyP.textContent = text;
    el.lyBtns.hidden = !withButtons;
  }

  function render(text) {
    lines = []; synced = false; active = -1; hasText = !!text;
    if (!text) { showEmpty('No lyrics yet', 'Add a .lrc file for lyrics that scroll with the song, or a .txt file / pasted text for plain lyrics.', true); return; }

    el.lyEmpty.hidden = true;
    el.lyBody.textContent = '';
    const parsed = parse(text);

    if (parsed.length >= 2) {                           // synced lyrics
      synced = true; lines = parsed;
      el.lyBody.className = 'ly-body';
      const frag = document.createDocumentFragment();
      parsed.forEach((l, i) => {
        const p = h('p', 'ly-line' + (l.text ? '' : ' gap'), l.text || '♪');
        p.dataset.i = i;
        p.onclick = () => S.player.seek(l.t);
        frag.appendChild(p);
      });
      el.lyBody.appendChild(frag);
      onTime({ pos: S.player.position() });
    } else {                                            // plain text lyrics
      el.lyBody.className = 'ly-body plain';
      const frag = document.createDocumentFragment();
      String(text).split(/\r?\n/).forEach((t) => frag.appendChild(t.trim() ? h('p', 'ly-plain', t) : h('p', 'ly-plain sp')));
      el.lyBody.appendChild(frag);
    }
  }

  /* find the line that matches the time (binary search) */
  function indexAt(pos) {
    let lo = 0, hi = lines.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].t <= pos + 0.12) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  function onTime(t) {
    if (!synced || !t) return;
    const i = indexAt(t.pos || 0);
    if (i === active) return;
    const nodes = el.lyBody.children;
    for (let k = 0; k < nodes.length; k++) {
      nodes[k].classList.toggle('on', k === i);
      nodes[k].classList.toggle('past', k < i);
    }
    active = i;
    if (i >= 0 && Date.now() > pauseUntil) nodes[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function loadFor(s) {
    const mine = ++token;
    song = s;
    if (!s) {
      el.lyTitle.textContent = 'Lyrics'; el.lySub.textContent = '';
      el.lyMenu.hidden = true;
      showEmpty('Nothing playing', 'Play a song first, then open its lyrics here.', false);
      return;
    }
    el.lyTitle.textContent = s.title;
    el.lySub.textContent = [s.artist, s.film].filter(Boolean).join(' · ');
    el.lyMenu.hidden = false;
    let text = '';
    try { text = (await S.db.getLyrics(s.id)) || ''; } catch (e) { S.log('lyrics', e); }
    if (mine !== token) return;
    render(text);
    if (synced) onTime({ pos: S.player.position() });
  }

  /* ---------- add / replace / remove ---------- */
  async function save(text) {
    text = String(text || '').trim();
    if (!text) { S.toast('That file is empty'); return false; }
    await S.db.setLyrics(song.id, text);
    render(text);
    S.toast('Lyrics saved');
  }

  function pasteSheet() {
    const box = h('div');
    const w = h('label', 'md-field');
    w.appendChild(h('span', '', 'Lyrics'));
    const ta = h('textarea'); ta.placeholder = 'Paste plain lyrics, or .lrc text with [00:12.50] times';
    w.appendChild(ta); box.appendChild(w);
    S.modal.open({
      title: 'Paste lyrics', content: box,
      actions: [
        { label: 'Save', kind: 'primary', onClick: () => save(ta.value) },
        { label: 'Cancel', kind: 'ghost' }
      ]
    });
  }

  function menuSheet() {
    const p = h('p', 'md-hint', song.title);
    const actions = [
      { label: 'Choose .lrc / .txt file', kind: 'ghost', onClick: () => { setTimeout(() => el.lyFile.click(), 50); } },
      { label: 'Paste lyrics', kind: 'ghost', onClick: () => { setTimeout(pasteSheet, 380); } }
    ];
    if (hasText) actions.push({ label: 'Remove lyrics', kind: 'danger', onClick: async () => { await S.db.deleteLyrics(song.id); render(''); S.toast('Lyrics removed'); } });
    actions.push({ label: 'Cancel', kind: 'ghost' });
    S.modal.open({ title: 'Lyrics', content: p, actions });
  }

  function init(mount) {
    root = mount; offs = []; active = -1; token = 0; synced = false;
    ['lyBack', 'lyTitle', 'lySub', 'lyMenu', 'lyBody', 'lyEmpty', 'lyEmptyT', 'lyEmptyP', 'lyBtns', 'lyChoose', 'lyPaste', 'lyFile']
      .forEach((id) => { el[id] = root.querySelector('#' + id); });

    el.lyBack.addEventListener('click', () => { if (history.length > 1) history.back(); else S.go('player'); });
    el.lyMenu.addEventListener('click', menuSheet);
    el.lyChoose.addEventListener('click', () => el.lyFile.click());
    el.lyPaste.addEventListener('click', pasteSheet);
    el.lyFile.addEventListener('change', async () => {
      const f = el.lyFile.files[0];
      el.lyFile.value = '';
      if (!f || !song) return;
      try { await save(await S.tags.readText(f)); } catch (e) { S.log('lyrics', e); S.toast('Could not read that file'); }
    });

    // pause auto-scroll for a moment when the user scrolls by hand
    scroller = root.closest('#screen');
    const hold = () => { pauseUntil = Date.now() + 3500; };
    if (scroller) {
      ['touchmove', 'wheel'].forEach((ev) => scroller.addEventListener(ev, hold, { passive: true }));
      offs.push(() => ['touchmove', 'wheel'].forEach((ev) => scroller.removeEventListener(ev, hold)));
    }

    offs.push(S.bus.on('player:time', onTime));
    offs.push(S.bus.on('player:track', (s) => loadFor(s)));
    loadFor(S.player.current());
  }

  function destroy() { offs.forEach((f) => f()); offs = []; }

  return { init, destroy, _parse: parse };
})());
