## 2025-03-24 - Accessible Dynamic UI Updates
**Learning:** Dynamic UI updates like "No results" feedback or empty states must be announced to screen reader users. Simply rendering text in the DOM is insufficient for accessibility.
**Action:** Always include `role="status"` and `aria-live="polite"` on elements that are dynamically injected to provide status updates or search feedback.
