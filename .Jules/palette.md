# Palette's Journal

## 2026-04-11 - Accessible Dynamic Updates
**Learning:** In this vanilla JS project, dynamic UI updates like 'No results' feedback or toast notifications are not automatically announced by screen readers unless they have explicit ARIA roles.
**Action:** Always include `role="status"` and `aria-live="polite"` on elements that appear or update dynamically to ensure accessibility.
