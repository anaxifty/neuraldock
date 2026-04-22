## 2025-04-22 - Improved Search Feedback & Button Accessibility
**Learning:** Dynamic UI updates like search "No results" messages must include `role="status"` and `aria-live="polite"` to be properly announced by screen readers. Additionally, programmatically clearing search inputs (e.g., when starting a "New Chat") is a vital micro-interaction that resets user context.
**Action:** Always include ARIA live regions for empty states in search results and ensure primary actions like "New Chat" clear global filters.
