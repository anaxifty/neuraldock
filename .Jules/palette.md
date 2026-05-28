# Palette's Journal 🎨

## 2025-05-28 - Unified Search Accessibility Pattern
**Learning:** Modern AI interfaces rely heavily on search (conversations, models, tools). Without proper ARIA labels and live regions for empty states, these features are invisible or confusing to screen reader users. Dynamic UI updates like "No results" must include `role="status"` and `aria-live="polite"`.
**Action:** Always pair search inputs with descriptive `aria-label` and ensure empty state feedback is announced via `aria-live`.
