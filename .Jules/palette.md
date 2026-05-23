# Palette's UX Journal 🎨

## 2025-05-14 - Accessible Search Feedback and Empty States
**Learning:** Dynamic UI updates like 'No results' feedback or search status messages must include `role="status"` and `aria-live="polite"` to ensure they are announced to screen reader users. Additionally, providing descriptive `aria-label` attributes on search inputs and marking decorative icons as `aria-hidden="true"` significantly reduces noise and improves clarity for assistive technologies.
**Action:** Always include ARIA live regions for empty search results and ensure all icon-accompanied inputs have explicit labels and hidden icons next time.
