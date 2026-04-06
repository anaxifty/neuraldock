## 2026-04-06 - Sidebar Search & Accessibility Polish
**Learning:** Icon-only buttons (Send, Stop, Attach, etc.) lacked ARIA labels, making them inaccessible to screen readers. Sidebar search also lacked an empty state and persisted across context changes (like starting a new chat), which caused user confusion.
**Action:** Always add `aria-label` to icon-only buttons and `aria-hidden="true"` to their decorative SVGs. Implement "No matches found" states for search inputs and ensure they clear upon primary state transitions (e.g., `newChat`).
