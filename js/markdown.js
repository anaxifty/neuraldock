/**
 * markdown.js — Markdown, syntax highlighting, KaTeX math, Mermaid diagrams
 * Depends on: marked, hljs, katex, mermaid (all CDN globals), utils.js
 */

'use strict';

// Configure libraries once
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: { primaryColor: '#1a1c1e', lineColor: '#3a3d40', textColor: '#e8e2d9' },
});

marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true,
});

/**
 * Render a markdown string to safe HTML.
 * Handles math (KaTeX), syntax highlighting, copy/canvas buttons on code blocks,
 * and Mermaid diagram wrappers.
 * @param {string} text
 * @returns {string} HTML string
 */
function renderMarkdown(text) {
  if (!text) return '';

  // 1. Protect math expressions from marked processing
  const mathMap = [];
  let t = text
    .replace(/\$\$[\s\S]+?\$\$/g, m => {
      mathMap.push({ type: 'display', src: m });
      return `%%MATH${mathMap.length - 1}%%`;
    })
    .replace(/\$[^\n$]+?\$/g, m => {
      mathMap.push({ type: 'inline', src: m });
      return `%%MATH${mathMap.length - 1}%%`;
    });

  let html;
  try {
    html = marked.parse(t);
  } catch (e) {
    return escHtml(text);
  }

  // 2. Restore math and render with KaTeX
  html = html.replace(/%%MATH(\d+)%%/g, (_, i) => {
    const { type, src } = mathMap[Number(i)];
    const inner = type === 'display' ? src.slice(2, -2) : src.slice(1, -1);
    try {
      return katex.renderToString(inner, { displayMode: type === 'display', throwOnError: false });
    } catch {
      return escHtml(src);
    }
  });

  // 3. Augment code blocks with header (lang label + copy/canvas buttons)
  //    Special handling for mermaid blocks
  html = html.replace(/<pre><code(.*?)>/g, (match, attrs) => {
    const langMatch = attrs.match(/class=".*?language-(\w+).*?"/);
    const lang = langMatch ? langMatch[1] : 'code';

    if (lang === 'mermaid') {
      return `<div class="mermaid-wrap"><pre><code${attrs}>`;
    }

    return `<pre>`
      + `<div class="code-block-header">`
      + `<span>${lang}</span>`
      + `<div class="code-block-btns">`
      + `<button class="copy-code-btn" onclick="copyCodeBlock(this)">Copy</button>`
      + `<button class="open-canvas-btn" onclick="openCanvas(this)" title="Open in canvas">⊞</button>`
      + `</div></div>`
      + `<code${attrs}>`;
  });

  // Close mermaid wrappers
  html = html.replace(/<\/code><\/pre>/g, (match, offset, str) => {
    const before = str.substring(Math.max(0, offset - 200), offset);
    return before.includes('mermaid-wrap') ? `</code></pre></div>` : match;
  });

  // 4. Sanitize with DOMPurify to prevent XSS
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ADD_ATTR: ['target'],
      USE_PROFILES: { html: true },
    });
  }

  return html;
}

/**
 * Render all unrendered mermaid blocks inside a container element.
 * Safe to call multiple times — uses a `data-rendered` guard.
 * @param {HTMLElement} container
 */
function renderMermaidBlocks(container) {
  container.querySelectorAll('.mermaid-wrap:not([data-rendered])').forEach(async wrap => {
    wrap.dataset.rendered = '1';
    const code = wrap.querySelector('code');
    if (!code) return;
    try {
      const { svg } = await mermaid.render('mermaid-' + Date.now(), code.textContent);
      const div = document.createElement('div');
      div.className = 'mermaid-rendered';
      div.innerHTML = svg;
      wrap.replaceWith(div);
    } catch (e) {
      console.warn('[mermaid] render failed:', e);
    }
  });
}
