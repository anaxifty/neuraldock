## 2026-05-14 - Search Accessibility and Empty States
**Learning:** For dynamic UI updates like search filtering, providing a "No results" message is critical for UX. To make it accessible, the message should have role="status" and aria-live="polite". However, applying these to a large container can be noisy; it's better to apply them directly to the status message itself.
**Action:** Always add role="status" and aria-live="polite" to empty-state feedback messages in search or list components.
