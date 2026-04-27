## 2025-05-14 - Sidebar Search Empty State & Reset
**Learning:** In a single-page app with filtered lists, providing a "No results" state and clearing filters on primary transitions (like starting a new task) prevents "empty list" confusion and state-related friction.
**Action:** Always implement a dedicated empty state for search inputs and ensure filters are programmatically reset when the user initiates a state transition that expects a fresh view.
