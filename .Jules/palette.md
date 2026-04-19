## 2025-05-14 - [Search Input Synchronization]
**Learning:** Programmatically clearing an input's `.value` in vanilla JS does not fire the 'input' event. This can lead to the UI being out of sync with the input's actual state.
**Action:** When clearing search inputs programmatically (e.g., during a 'New Chat' action), always follow the assignment with a manual call to the rendering function (e.g., `renderSidebar()`).

## 2025-05-14 - [Accessible Empty States]
**Learning:** Providing explicit feedback for empty search results is a key UX pattern. To make this accessible, the "No results" message should use `role="status"` and `aria-live="polite"` so screen readers announce it immediately.
**Action:** Use `role="status"` and `aria-live="polite"` for any dynamic UI updates that provide feedback on user actions like searching or filtering.

## 2025-05-14 - [Icon-only Button Accessibility]
**Learning:** Icon-only buttons (using SVGs or characters like '➤') are completely opaque to screen readers without an `aria-label`. Decorative SVGs inside buttons should also be hidden to prevent redundant announcements.
**Action:** Always add `aria-label` to icon-only buttons and `aria-hidden="true"` to their internal decorative icons.
