## 2026-04-29 - [Search Accessibility and Experience]
**Learning:** Empty search results should provide clear feedback to the user and be announced by screen readers using ARIA live regions. Additionally, search state should be maintained across UI updates or explicitly cleared during major transitions to prevent confusing the user.
**Action:** Implement "No results found" messages with `role="status"` and `aria-live="polite"`. Ensure search inputs are cleared during state transitions like creating a new conversation.
