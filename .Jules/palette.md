## 2026-04-01 - Programmatic Search Clearing UX
**Learning:** Programmatically clearing a search input via `.value = ''` does not trigger the `input` event. If the UI relies on this event for filtering, the view will remain in a stale filtered state despite the input being empty.
**Action:** Always manually call the rendering/filtering function (e.g., `renderSidebar()`) immediately after clearing a search input via JavaScript.
