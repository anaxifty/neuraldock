## 2025-03-24 - [Multiple Security Hardening Measures]
**Vulnerability:**
1. **Markdown XSS:** AI-generated content was rendered using `innerHTML` without sanitization.
2. **Insecure Canvas Sandboxing:** User-generated code executed in iframes could access the parent window's sensitive session data.
3. **Tabnabbing Risk:** External links were missing `rel="noopener"`.

**Learning:**
1. AI outputs are untrusted and must be treated as such, even when using popular libraries like `marked.js`.
2. Code execution features need strict isolation to protect application state and tokens.
3. Standard target="_blank" security is easily overlooked in modern web apps.

**Prevention:**
1. Always use a sanitization library like `DOMPurify` when rendering Markdown.
2. Ensure iframes for executing user code have the `sandbox` attribute.
3. Use linting rules to enforce `rel="noopener"` on external links.
