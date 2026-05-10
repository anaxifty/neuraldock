## 2025-05-22 - [Search Accessibility & UI Consistency]
**Learning:** The application uses a consistent `.model-no-results` class for empty states in both the model selector and sidebar search. To ensure these are accessible to screen readers, they must include `role="status"` and `aria-live="polite"` to announce the lack of results dynamically.
**Action:** Always include ARIA live region attributes when rendering "No results" feedback in search components.

## 2025-05-22 - [Icon-Only Button Accessibility]
**Learning:** Many interactive elements in this app (sidebar collapse, chat actions, IDE toolbar) are icon-only buttons. Without `aria-label`, these are completely opaque to screen reader users.
**Action:** Every icon-only button must have an `aria-label` describing its action, and the internal `<svg>` should be marked as `aria-hidden="true"`.
