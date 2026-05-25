## 2026-05-25 - Accessible Search Feedback and Persistent State
**Learning:** Dynamic UI updates like 'No results' feedback or status messages must include `role="status"` and `aria-live="polite"` to ensure they are announced to screen reader users. Additionally, clearing search filters during primary state transitions (like 'New Chat') provides a cleaner UX by resetting the interface to a known consistent state.
**Action:** Always wrap empty state messages in live regions and consider if existing search filters should be cleared when the user initiates a fresh action.
