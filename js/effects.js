/**
 * effects.js — Visual enhancements: login particles, ripple, cursor glow,
 *              placeholder cycling, tip card fade-in
 * Depends on: nothing (pure DOM)
 * NOTE: The addThinkingEl glow is now inlined in chat.js — no infinite-recursion risk.
 */

'use strict';

// ── Login particle field ───────────────────────────────────────────────────
(function initLoginParticles() {
  const canvas = document.getElementById('login-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], animFrame;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkParticle() {
    return {
      x:       Math.random() * W,
      y:       Math.random() * H,
      r:       Math.random() * 1.4 + 0.4,
      vx:      (Math.random() - 0.5) * 0.3,
      vy:      (Math.random() - 0.5) * 0.3,
      o:       Math.random() * 0.4 + 0.1,
      life:    0,
      maxLife: Math.random() * 300 + 200,
    };
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < 80; i++) particles.push(mkParticle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(212,168,83,${(1 - d / 120) * 0.12})`;
          ctx.lineWidth   = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach((p, idx) => {
      p.x += p.vx; p.y += p.vy; p.life++;
      if (p.x < -10)   p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10)   p.y = H + 10;
      if (p.y > H + 10) p.y = -10;
      const fade = p.life < 60
        ? p.life / 60
        : p.life > p.maxLife - 60
          ? (p.maxLife - p.life) / 60
          : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,168,83,${p.o * fade})`;
      ctx.fill();
      if (p.life >= p.maxLife) particles[idx] = mkParticle();
    });
    animFrame = requestAnimationFrame(tick);
  }

  init();
  tick();
  window.addEventListener('resize', () => { cancelAnimationFrame(animFrame); init(); tick(); });

  // Stop animation when login screen is hidden (saves CPU)
  const ls = document.getElementById('login-screen');
  if (ls) {
    new MutationObserver(() => {
      if (ls.style.display === 'none') {
        cancelAnimationFrame(animFrame);
      }
    }).observe(ls, { attributes: true, attributeFilter: ['style'] });
  }
})();


// ── Ripple effect on primary buttons ──────────────────────────────────────
(function addRipples() {
  // Inject keyframes once
  const st = document.createElement('style');
  st.textContent = '@keyframes __ripple-anim{to{transform:scale(60);opacity:0;}}';
  document.head.appendChild(st);

  const TARGETS = '.send-btn, .gen-btn, .speak-btn, .login-btn, .new-chat-btn, .tab-btn';
  document.addEventListener('click', e => {
    const btn = e.target.closest(TARGETS);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const rip  = document.createElement('span');
    rip.style.cssText =
      `position:absolute;border-radius:50%;background:rgba(255,255,255,.18);` +
      `pointer-events:none;width:4px;height:4px;` +
      `left:${e.clientX - rect.left}px;top:${e.clientY - rect.top}px;` +
      `transform:scale(0);animation:__ripple-anim .55s ease-out forwards;`;
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(rip);
    rip.addEventListener('animationend', () => rip.remove());
  });
})();


// ── Subtle cursor ambient glow ─────────────────────────────────────────────
(function cursorGlow() {
  const glow = document.createElement('div');
  glow.id = '__cursor-glow';
  glow.style.cssText =
    'position:fixed;pointer-events:none;z-index:9999;' +
    'width:240px;height:240px;border-radius:50%;' +
    'background:radial-gradient(circle,rgba(212,168,83,.045) 0%,transparent 70%);' +
    'transform:translate(-50%,-50%);transition:opacity .4s ease;opacity:0;';
  document.body.appendChild(glow);
  let visible = false;
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
    if (!visible) { glow.style.opacity = '1'; visible = true; }
  });
  document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; visible = false; });
})();


// ── Rotating placeholder hints in the chat textarea ───────────────────────
(function cyclePlaceholders() {
  const ta = document.getElementById('chatInput');
  if (!ta) return;
  const phrases = [
    'Ask anything…',
    'Summarize a document…',
    'Write code for me…',
    'Explain a concept…',
    'Generate ideas…',
    'Debug this error…',
  ];
  let idx = 0;
  setInterval(() => {
    if (document.activeElement === ta) return;
    idx = (idx + 1) % phrases.length;
    ta.placeholder = phrases[idx];
  }, 3500);
})();


// ── Intersection-based fade-in for tip cards ──────────────────────────────
(function observeTips() {
  if (!window.IntersectionObserver) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach((en, i) => {
      if (!en.isIntersecting) return;
      setTimeout(() => {
        en.target.style.opacity   = '1';
        en.target.style.transform = 'translateY(0)';
      }, i * 60);
      obs.unobserve(en.target);
    });
  }, { threshold: 0.1 });

  function observeAll() {
    document.querySelectorAll('.tip:not([data-observed])').forEach(tip => {
      tip.dataset.observed = '1';
      tip.style.cssText   += 'opacity:0;transform:translateY(14px);' +
        'transition:opacity .35s ease,transform .35s ease,border-color .2s,background .2s,box-shadow .2s;';
      obs.observe(tip);
    });
  }

  observeAll();
  // Watch for dynamically added tips
  new MutationObserver(observeAll).observe(document.body, { childList: true, subtree: true });
})();
