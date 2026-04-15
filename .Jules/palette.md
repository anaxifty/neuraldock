## 2026-04-15 - Synchronizing ARIA labels with temporary UI feedback
**Learning:** When providing immediate inline feedback by changing an element's text content (e.g., from "Copy" to "Copied!"), it is critical to also synchronize the `aria-label` attribute. If the `aria-label` is not updated, screen reader users might miss the state change, as the label takes precedence over the text content.
**Action:** Always update the `aria-label` alongside the `textContent` in feedback loops, and restore both to their original states after the timeout.
