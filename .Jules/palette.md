## 2025-05-14 - [A11y & Search UX]
**Learning:** Icon-only buttons (Send, Stop, Attach, etc.) frequently lack `aria-label` attributes, relying only on `title` which is insufficient for many screen readers. Additionally, persistent search inputs can cause confusion if not cleared during primary state transitions (like starting a 'New Chat').
**Action:** Always add `aria-label` to icon-only buttons. Ensure search inputs are cleared or reset when the user initiates a fundamental state change to provide a fresh context.
