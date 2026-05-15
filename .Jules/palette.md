## 2025-05-15 - [Clipboard Feedback & A11y]
**Learning:** Users need immediate inline confirmation for clipboard actions. Using `innerHTML` to preserve SVG icons while updating text is a reliable pattern. Using a `_copying` property as a mutex prevents race conditions on button state restoration.
**Action:** Always use `copyFeedback` utility for copy buttons, ensuring `aria-label` synchronization.
