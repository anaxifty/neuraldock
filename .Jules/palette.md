## 2026-05-05 - [Icon Preservation during Feedback]
**Learning:** Using `textContent` to update button labels (e.g., from "Copy" to "Copied!") destructively removes any child elements, including decorative SVGs.
**Action:** When updating button text for feedback, either target a specific text-only child node or use `innerHTML` while preserving the SVG's `outerHTML` (e.g., `btn.innerHTML = btn.querySelector('svg').outerHTML + ' Copied!'`).

## 2026-05-05 - [Accessibility Syncing]
**Learning:** Temporary UI status changes (like "Copied!") must be mirrored in `aria-label` to ensure screen reader users receive the update.
**Action:** Always synchronize `aria-label` with temporary text feedback, and ensure the original label is restored after the timeout.
