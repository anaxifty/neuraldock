## 2025-05-14 - Optimized `escHtml` with Regex-based Escaping
**Learning:** The previous implementation of `escHtml` used a DOM-based approach (`document.createElement('div')` and `innerHTML`), which is significantly slower than regex-based replacement. This is because creating DOM nodes and accessing the HTML parser/serializer is expensive, especially when used frequently in UI updates or rendering long lists.
**Action:** Use regex-based replacement for simple string manipulations like HTML escaping to avoid unnecessary DOM overhead and layout thrashing.
