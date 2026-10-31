/* ===== bus.js — messages between sections =====
   Sections never call each other. They shout and listen:
     Saregaana.bus.emit('song:play', id)
     const off = Saregaana.bus.on('song:play', id => { ... });  off();   */
(function () {
  'use strict';
  const S = window.Saregaana;
  const map = {};

  S.bus = {
    on(ev, fn) {
      (map[ev] = map[ev] || []).push(fn);
      return () => S.bus.off(ev, fn);          // call the result to stop listening
    },
    off(ev, fn) {
      map[ev] = (map[ev] || []).filter((f) => f !== fn);
    },
    emit(ev, data) {
      (map[ev] || []).slice().forEach((fn) => {
        try { fn(data); } catch (e) { S.log('bus:' + ev, e); }   // one bad listener never breaks others
      });
    }
  };
})();
