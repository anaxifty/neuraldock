## 2025-05-15 - [Accessibility & Feedback Sweep]
**Learning:** Icon-only buttons and dynamic search results require explicit ARIA attributes (`aria-label`, `role="status"`, `aria-live="polite"`) to be truly accessible. Inline feedback for copy actions (changing text/label to "Copied!") significantly improves user confidence.
**Action:** Always include `aria-label` for icon buttons and use `aria-live` for "no results" messages. Ensure copy feedback is tied to successful clipboard resolution.
