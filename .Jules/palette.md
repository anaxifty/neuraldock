## 2026-04-12 - Accessible Search Feedback
**Learning:** Dynamic UI updates that convey state changes (like "No results found") are invisible to screen readers unless marked with `role="status"` and `aria-live="polite"`.
**Action:** Always include ARIA live region attributes when implementing empty states or search feedback to ensure parity for assistive technology users.
