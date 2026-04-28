## 2026-04-28 - Accessible Search Feedback
**Learning:** For dynamic search results (like sidebar conversation filtering or model selection), screen reader users often miss the status of their query (e.g., if no matches were found). Using `role="status"` combined with `aria-live="polite"` ensures that "No results" messages are announced as soon as they appear in the DOM.
**Action:** Always wrap empty state feedback in elements with `role="status"` and `aria-live="polite"` to provide immediate non-visual context for filter actions.

## 2026-04-28 - Interactive Copy Feedback
**Learning:** Users appreciate immediate confirmation for clipboard actions. Temporarily changing a button's text (e.g., "Copy" -> "Copied!") provides high-confidence visual feedback. However, this must be synchronized with the `aria-label` to ensure screen reader users also receive the "Copied!" status.
**Action:** When implementing copy-to-clipboard buttons, trigger a temporary (2-second) transition of both text content and ARIA label within the success callback of the `navigator.clipboard` promise.
