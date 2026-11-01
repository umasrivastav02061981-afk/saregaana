/* ===== modal.js — S.modal.open({ title, content, actions }) / S.modal.confirm({...}) =====
   actions: [{ label, kind: 'primary' | 'ghost' | 'danger', onClick }]
   onClick can return false to keep the sheet open. */
Saregaana.register('modal', (function () {
  'use strict';
  const S = window.Saregaana;
  let root, titleEl, bodyEl, actEl, onClose = null;

  function open(o) {
    titleEl.textContent = o.title || '';
    bodyEl.textContent = '';
    if (o.content) bodyEl.appendChild(o.content);
    actEl.textContent = '';
    onClose = o.onClose || null;

    (o.actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'md-btn ' + (a.kind || 'ghost');
      b.textContent = a.label;
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        b.disabled = true;
        let keep = false;
        try { keep = (a.onClick ? await a.onClick() : undefined) === false; }
        catch (e) { S.log('modal', e); S.toast('Something went wrong'); }
        b.disabled = false;
        if (!keep) { onClose = null; close(); }
      });
      actEl.appendChild(b);
    });

    root.hidden = false;
    document.body.classList.add('md-open');
    requestAnimationFrame(() => root.classList.add('show'));
    const f = bodyEl.querySelector('input');
    if (f) setTimeout(() => f.focus({ preventScroll: true }), 320);
  }

  function close() {
    root.classList.remove('show');
    document.body.classList.remove('md-open');
    setTimeout(() => { if (!root.classList.contains('show')) root.hidden = true; }, 300);
  }

  function dismiss() {                      // backdrop tap or Esc
    if (root.hidden) return;
    const cb = onClose; onClose = null;
    close();
    if (cb) cb();
  }

  function confirm(o) {
    return new Promise((resolve) => {
      const p = document.createElement('p');
      p.className = 'md-text';
      p.textContent = o.text || '';
      open({
        title: o.title || 'Are you sure?',
        content: p,
        onClose: () => resolve(false),
        actions: [
          { label: o.yes || 'Yes', kind: o.danger ? 'danger' : 'primary', onClick: () => resolve(true) },
          { label: 'Cancel', kind: 'ghost', onClick: () => resolve(false) }
        ]
      });
    });
  }

  function init(mount) {
    root = S.$('#mdRoot', mount);
    titleEl = S.$('#mdTitle', mount);
    bodyEl = S.$('#mdBody', mount);
    actEl = S.$('#mdActions', mount);
    S.$('#mdBack', mount).addEventListener('click', dismiss);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });
    S.modal = { open, close, confirm };
  }

  return { init };
})());
