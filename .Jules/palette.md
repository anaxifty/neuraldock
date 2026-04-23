## 2025-05-14 - Initial Palette Assessment
**Learning:** The application uses a "no-results" pattern for the model selector but lacks it for the main sidebar conversation search. Accessibility for icon-only buttons is inconsistent.
**Action:** Implement a consistent "No results" feedback in the sidebar and ensure it is announced by screen readers using `role="status"` and `aria-live="polite"`.
