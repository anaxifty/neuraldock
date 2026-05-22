## 2025-05-14 - [Copy Feedback Pattern]
**Learning:** Toast notifications can be easily missed if they appear far from the interaction point (e.g., bottom right vs. message action bar). Inline feedback on the button itself provides immediate confirmation.
**Action:** Use the `copyFeedback` utility in `js/utils.js` for all clipboard actions. It preserves icons, updates text to 'Copied!', and synchronizes `aria-label` for screen readers.
