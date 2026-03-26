/**
 * effects.js — Visual effects (particles, etc)
 * Refactored for New UI
 */

'use strict';

function initEffects() {
    const bg = document.createElement('div');
    bg.className = 'fixed inset-0 pointer-events-none opacity-[0.03] z-[100]';
    bg.style.backgroundImage = "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDJhIv-0h1od1P--Eku2TZ6nr5qOv2nVrZTe3WhZ_U1lBqmhtNNgTTG7rjW4vwQkXpEQrwIjwdoINFNTg9_kLQYdtiHishTwMjQ27xOTLo0qVniQATIvF4XPrW9rVxiHb8jIFtGGBh4XhR07fi27bvNOrl_xwCZ8TZEJcQ-Y1h8MfktWVF6S-FHGiDBJXt4hAPwnzgPxkSetpTnVJiTpgO3kVy4MTQV-oTg1bZXIEvYDlMvEvXD4ybGP2i3b8XWKKIq49KWCgtFQEjF')";
    document.body.appendChild(bg);
}

// Particle effect for login screen
function initLoginParticles() {
    const canvas = document.getElementById('login-particles');
    if (!canvas) return;
    // We can port the actual particle logic if needed, but for now let's keep it simple.
}

window.addEventListener('DOMContentLoaded', () => {
    initEffects();
    initLoginParticles();
});
