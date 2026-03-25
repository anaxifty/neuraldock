## 2025-03-25 - Sidebar Search Empty State
**Learning:** Adding a "No matches found" state to search inputs prevents user confusion when a filter returns no results, especially when the sidebar might otherwise appear broken or unexpectedly empty.
**Action:** Always provide an explicit empty state message for search/filter operations using consistent typography (e.g., .model-no-results class).

## 2025-03-25 - Search Context Reset
**Learning:** Users expect search filters to be cleared when navigating to a "New" state (like New Chat) to provide a clean slate for the new activity.
**Action:** Clear search inputs and reset filter states when the user initiates a primary state transition.
