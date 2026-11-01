window.RD_InkUI = (function () {
  'use strict';

  const HOVER_SEL = 'button, .hnav, .area-chip, .song-row, .level-card, .avatar-card, .theme-card, #daily-card, #endless-card, .endless-band, .tool-btn, .ic-btn, .cr-back, #pbar-avatar, .custom-av-upload, [role="button"], label.toggle';
  const SKIP_SEL = '#g-lanes, .lane, .lane-btn, #cr-grid, .cr-cell, .bass-step, input[type="range"], #g-overlay .ov-key';

  let styleEl = null;
  let last = '';

  let probe = null;
  function read(k) {
    if (!probe) {
      probe = document.createElement('i');
      probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
    }
    probe.style.color = 'var(' + k + ')';
    return getComputedStyle(probe).color;
  }

  function fillLogos(tokens) {
    document.querySelectorAll('[data-logo]').forEach(el => {
      el.innerHTML = window.RD_Ink.logoSVG({ ink: tokens.ink, ring: tokens.dtap, tap: tokens.tap, dtap: tokens.accent, paper: window.RD_Ink.lighten(tokens.bg, 0.55), anim: el.hasAttribute('data-anim') });
    });
  }

  function refresh() {
    if (!window.RD_Ink || !document.body) return;
    fillLogos(window.RD_Ink.themeTokens(read));
    const flat = !document.body.classList.contains('gfx-modern');
    const key = (window.RD_THEMES ? 't' : '') + document.body.className + '|' + flat + '|' + read('--bg') + read('--bg3') + read('--bg4') + read('--accent') + read('--text') + read('--ink');
    if (key === last) return;
    last = key;
    const tokens = window.RD_Ink.themeTokens(read);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'ink-rules';
      document.head.appendChild(styleEl);
    }
    const extra = (window.RD_THEMES || []).map(t => ({ sel: '.theme-card[data-theme="' + t.id + '"]', fill: t.bg, ink: t.text || '#3a3023' }));
    styleEl.textContent = window.RD_Ink.rules(tokens, { flat, extra }) + '\n' + window.RD_Ink.playRules(tokens, { flat });
  }

  function kindFor(el) {
    if (el.closest('.locked, [disabled], .disabled')) return 'deny';
    if (el.closest('.hnav, .shop-subnav button')) return 'tab';
    if (el.closest('.cr-back, #g-menu-btn, .mb-close-btn, .ov-menu-btn')) return 'back';
    if (el.closest('.chaos-toggle, .adv-toggle, .bg-radio-btn')) return el.closest('.on, .sel, .active') ? 'on' : 'off';
    return 'click';
  }

  function sfx(kind) {
    if (typeof window.RD_uiSfx === 'function') window.RD_uiSfx(kind);
  }

  function labelIcons(root) {
    (root || document).querySelectorAll('button[title]:not([aria-label])').forEach(b => { b.setAttribute('aria-label', b.getAttribute('title')); });
    (root || document).querySelectorAll('svg.ic').forEach(s => { if (!s.hasAttribute('aria-hidden')) s.setAttribute('aria-hidden', 'true'); });
  }

  function install() {
    labelIcons();
    new MutationObserver(() => labelIcons()).observe(document.body, { childList: true, subtree: true });
    let hovering = null;
    document.addEventListener('pointerover', e => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest && e.target.closest(HOVER_SEL);
      if (!el || el === hovering || el.closest(SKIP_SEL)) return;
      hovering = el;
      sfx('hover');
    }, true);
    document.addEventListener('pointerout', e => {
      if (hovering && !hovering.contains(e.relatedTarget)) hovering = null;
    }, true);
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest && e.target.closest(HOVER_SEL);
      if (!el || el.closest(SKIP_SEL)) return;
      sfx('press');
    }, true);
    document.addEventListener('click', e => {
      const el = e.target.closest && e.target.closest(HOVER_SEL);
      if (!el || el.closest(SKIP_SEL)) return;
      setTimeout(() => sfx(kindFor(el)), 0);
    }, true);
    refresh();
    new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();

  return { refresh, kindFor };
})();
