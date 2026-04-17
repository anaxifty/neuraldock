## 2025-03-24 - Accessible Empty States for Search

**Learning:** Dynamic UI updates like "No matches found" or search status messages must include `role="status"` and `aria-live="polite"` to ensure they are announced to screen reader users. Without these, the visual change of "no results" is invisible to assistive technologies.

**Action:** Use the `.model-no-results` CSS class and apply `role="status"` and `aria-live="polite"` attributes when rendering empty state placeholders in search results or filtered lists.
