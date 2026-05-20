# Palette's UX Journal

## 2026-05-20 - Reusable Clipboard Feedback Pattern
**Learning:** Immediate inline feedback for clipboard actions (e.g., changing button text to 'Copied!') significantly improves user confidence compared to just showing a toast. Preserving icons using `innerHTML` and `outerHTML` ensures visual consistency during the transition. Synchronizing `aria-label` with the feedback text is essential for screen reader accessibility. Adding a delay before closing modals after a copy action (e.g., 700ms) is necessary for users to perceive the success state.
**Action:** Use the `copyFeedback(btn, successText, delay)` utility in `js/utils.js` for all future clipboard operations. Ensure event listeners use standard `function()` expressions to access `this` (the button).
