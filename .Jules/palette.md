## 2025-05-11 - Accessible Search Feedback and Persistent State
**Learning:** For dynamic search result areas, using `role="status"` and `aria-live="polite"` on the "No results found" container ensures that screen readers announce the search outcome immediately to the user. Additionally, preserving the search state across UI transitions (like pinning a chat) prevents user disorientation and maintains the filtered context.
**Action:** Always include a live-updating status region for search results and ensure that rendering functions for filtered lists use the current input value as the default state.

**Standardized ARIA labels for AI Studio:**
- `#sidebar-collapse-btn`: 'Collapse sidebar'
- `#hamburger-btn`: 'Toggle sidebar'
- `#attach-btn`: 'Attach file'
- `#voice-input-btn`: 'Voice input'
- `#chatSendBtn`: 'Send message'
- `#chatStopBtn`: 'Stop generation'
- `#ide-save-btn`: 'Save file'
- `#ide-run-btn`: 'Run code'
- `#canvas-close-btn`: 'Close canvas'
- `#canvas-copy-btn`: 'Copy code'
- `#canvas-run-btn`: 'Run code'
