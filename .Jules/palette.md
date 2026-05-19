## 2025-05-14 - Accessible Empty Search States
**Learning:** Dynamic UI updates like 'No results' feedback or status messages must include `role="status"` and `aria-live="polite"` to ensure they are announced to screen reader users. This follows the pattern already established in the model search dropdown.
**Action:** Always check for empty search result states and ensure they provide clear, accessible feedback to the user.
