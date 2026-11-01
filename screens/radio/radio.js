/* ===== radio.js — HOME: tune the dial to pick an era-station ===== */
Saregaana.register('radio', (function () {
  'use strict';
  const S = window.Saregaana;

  // The 4 stations (eras). "at" = where it sits on the dial (0 to 1)
  const STATIONS = [
    { id: 'old',      at: 0.12, hi: 'पुराने नग़मे',      short: 'पुराने नग़मे', en: 'Old Classics',       era: '1960s – 1980s', tag: '60s–80s' },
    { id: 'nineties', at: 0.38, hi: '90 के सुनहरे गीत', short: '90 के गीत',    en: 'Golden Nineties',    era: '1990 – 1999',   tag: '1990s' },
    { id: 'romance',  at: 0.62, hi: 'रोमांस 2000–2018',  short: 'रोमांस',      en: 'Romance 2000–2018',  era: '2000 – 2018',   tag: '2000–18' },
    { id: 'mix',      at: 0.88, hi: 'मेरा मिक्स',        short: 'मेरा मिक्स',  en: 'My Mix',             era: 'All your songs', tag: 'All' }
  ];
  const SNAP = 0.05;          // how close the needle must be to "catch" a station

  let root, el = {}, tune = 0.12, locked = null, drag = null, tween = 0, offs = [];

  function on(target, ev, fn, opt) {
    target.addEventListener(ev, fn, opt);
    offs.push(() => target.removeEventListener(ev, fn, opt));
  }

  /* ---------- build the dial ---------- */
  function buildScale() {
    let html = '';
    for (let i = 0; i <= 40; i++) {
      const big = i % 8 === 0, mid = i % 4 === 0;
      html += '<span class="t' + (big ? ' big' : mid ? ' mid' : '') + '">' + (big ? '<em>' + (88 + i / 2) + '</em>' : '') + '</span>';
    }
    el.rdScale.innerHTML = html;
  }

  function buildPresets() {
    el.rdPresets.innerHTML = STATIONS.map((s) =>
      '<button class="rd-pre" type="button" data-id="' + s.id + '"><b lang="hi">' + s.short + '</b><small>' + s.tag + '</small></button>'
    ).join('');
    S.$$('.rd-pre', el.rdPresets).forEach((b) => on(b, 'click', () => {
      const st = STATIONS.find((x) => x.id === b.dataset.id);
      S.buzz(10);
      glide(st.at, 520);
    }));
  }

  /* ---------- station card ---------- */
  function countText(st) {
    // Step 2 will add Saregaana.library.count(stationId). Until then: 0 songs.
    const n = (S.library && S.library.count && S.library.count(st.id)) || 0;
    return n ? n + (n === 1 ? ' song' : ' songs') + ' on this station' : 'No songs yet — add some!';
  }

  function showStation(st) {
    el.rdCard.classList.remove('is-static');
    el.rdCardEra.textContent = st.era;
    el.rdCardHi.textContent = st.hi;
    el.rdCardEn.textContent = st.en;
    el.rdCount.textContent = countText(st);
    el.rdGname.textContent = st.short;
    el.rdAir.classList.add('on');
    el.rdGlass.classList.add('lit');
    S.$$('.rd-pre', el.rdPresets).forEach((b) => b.classList.toggle('on', b.dataset.id === st.id));
  }

  function showStatic() {
    el.rdCard.classList.add('is-static');
    el.rdCardEra.textContent = '· · ·';
    el.rdCardHi.textContent = 'ट्यून हो रहा है…';
    el.rdCardEn.textContent = 'Tuning…';
    el.rdCount.textContent = '';
    el.rdGname.textContent = '';
    el.rdAir.classList.remove('on');
    el.rdGlass.classList.remove('lit');
    S.$$('.rd-pre', el.rdPresets).forEach((b) => b.classList.remove('on'));
  }

  /* ---------- tuning ---------- */
  function paint() {
    el.rdGlass.style.setProperty('--t', tune);
    el.rdKnob.style.setProperty('--r', (-135 + tune * 270) + 'deg');
    const f = 88 + tune * 20;
    el.rdFreq.textContent = f.toFixed(1);
    el.rdKnob.setAttribute('aria-valuenow', f.toFixed(1));
  }

  function check(silent) {
    const near = STATIONS.find((s) => Math.abs(s.at - tune) < SNAP) || null;
    if (near === locked && !silent) return;
    locked = near;
    if (near) {
      showStation(near);
      if (!silent) {
        S.buzz(14);
        S.store.set('station', near.id);
        S.bus.emit('station:change', near);
      }
    } else {
      showStatic();
    }
  }

  function setTune(v, silent) {
    tune = Math.min(1, Math.max(0, v));
    paint();
    check(silent);
  }

  function glide(to, ms) {
    cancelAnimationFrame(tween);
    const from = tune, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setTune(from + (to - from) * e);
      if (k < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }

  /* ---------- knob: drag in a circle ---------- */
  function angle(e) { return Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180 / Math.PI; }

  function bindKnob() {
    const k = el.rdKnob;
    on(k, 'pointerdown', (e) => {
      cancelAnimationFrame(tween);
      k.setPointerCapture(e.pointerId);
      const r = k.getBoundingClientRect();
      drag = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, a: 0 };
      drag.a = angle(e);
    });
    on(k, 'pointermove', (e) => {
      if (!drag) return;
      const a = angle(e);
      let d = a - drag.a;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      drag.a = a;
      setTune(tune + d / 270);
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      const near = STATIONS.find((s) => Math.abs(s.at - tune) < 0.09);   // gentle pull-in
      if (near) glide(near.at, 220);
    };
    on(k, 'pointerup', end);
    on(k, 'pointercancel', end);

    on(k, 'keydown', (e) => {
      const step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setTune(tune + step); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setTune(tune - step); }
    });
  }

  /* ---------- start / stop ---------- */
  function init(mount) {
    root = mount; offs = []; locked = null; drag = null;
    ['rdHi', 'rdEn', 'rdAir', 'rdScale', 'rdGlass', 'rdFreq', 'rdGname', 'rdKnob', 'rdPresets',
     'rdCard', 'rdCardEra', 'rdCardHi', 'rdCardEn', 'rdCount', 'rdPlay', 'rdAdd'
    ].forEach((id) => { el[id] = root.querySelector('#' + id); });

    const g = S.greeting();
    el.rdHi.textContent = g.hi;
    el.rdEn.textContent = g.en;

    buildScale();
    buildPresets();
    bindKnob();

    on(el.rdPlay, 'click', () => {
      if (!locked) return;
      const n = (S.library && S.library.count && S.library.count(locked.id)) || 0;
      if (!n) { S.toast('Add songs first'); return; }
      S.bus.emit('station:play', locked);   // core/player.js listens and starts the station
      S.go('player');
    });
    on(el.rdAdd, 'click', () => S.go('add'));
    S.$$('[data-go]', root).forEach((b) => on(b, 'click', () => S.go(b.dataset.go)));

    // keep the song count fresh when songs are added or deleted
    offs.push(S.bus.on('library:changed', () => { if (locked) showStation(locked); }));

    // start on the last station you used
    const saved = STATIONS.find((s) => s.id === S.store.get('station', 'old')) || STATIONS[0];
    setTune(saved.at, true);
  }

  function destroy() {
    cancelAnimationFrame(tween);
    offs.forEach((f) => f());
    offs = [];
  }

  return { init, destroy };
})());
