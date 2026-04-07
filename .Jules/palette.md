## 2025-03-24 - [Sidebar Search Empty State]
**Learning:** In a vanilla JS app with a dynamic sidebar, clearing a search input programmatically requires manually calling the render function (e.g., `renderSidebar()`) since the `input` event listener won't fire on direct `.value` assignment. Using existing CSS classes like `.model-no-results` ensures visual consistency for empty states across different components (search vs. dropdowns).
**Action:** When implementing programmatic resets of search inputs, always trigger the UI refresh manually and leverage shared 'empty-state' CSS classes.
