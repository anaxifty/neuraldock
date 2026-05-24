## 2026-05-24 - [Accessible Clipboard Feedback]
**Learning:** Toast notifications are often disconnected from the user's point of interaction (the button). Implementing inline visual feedback (text/color changes) and synchronizing ARIA labels ensures that both sighted and screen reader users get immediate confirmation of a successful copy action.
**Action:** Use the `copyFeedback` utility in `js/utils.js` for all clipboard actions. Always preserve SVG icons when updating button content and ensure ARIA labels are temporarily updated to match the visual "Copied!" state.
