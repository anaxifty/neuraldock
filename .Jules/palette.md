# Palette's Journal - NeuralDock

## 2025-05-14 - Search Accessibility Pattern
**Learning:** Dynamic UI updates like "No results" feedback or search status messages must include `role="status"` and `aria-live="polite"` to ensure they are announced to screen reader users immediately upon appearance.
**Action:** Always wrap empty state messages in containers with these ARIA attributes when they result from a user-initiated search or filter.

## 2025-05-14 - Icon-only Button Accessibility
**Learning:** In a dense, feature-rich interface like AI Studio, icon-only buttons (Send, Stop, Attach, etc.) must have explicit `aria-label` attributes even if they have a `title` attribute, as screen readers sometimes ignore `title` on buttons. Decorative SVGs inside these buttons should be explicitly hidden with `aria-hidden="true"`.
**Action:** Audit all interactive elements with no text content and apply standard ARIA labeling patterns.
