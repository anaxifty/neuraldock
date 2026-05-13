## 2025-05-15 - Clipboard feedback implementation
**Learning:** Providing immediate inline feedback (e.g., changing button text to 'Copied!') in addition to toast notifications significantly improves user confidence in copy operations. When implementing this for buttons with SVG icons, using `innerHTML` and preserving the SVG's `outerHTML` ensures the visual style remains consistent during the feedback state.
**Action:** Use the `copyFeedback` utility pattern for all primary clipboard actions to ensure consistent interaction confirmation across the app.
