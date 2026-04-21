## 2026-04-21 - [Sidebar Search & Accessibility]
**Learning:** Programmatic changes to input `.value` do not trigger the 'input' event, requiring manual re-renders. Dynamic UI updates like 'No results' feedback or status messages must include `role="status"` and `aria-live="polite"` to ensure they are announced to screen reader users.
**Action:** Always manually call re-render functions (e.g., `renderSidebar()`) after programmatically clearing search inputs. Use appropriate ARIA live regions for all asynchronous or filter-based UI updates.
