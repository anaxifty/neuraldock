# NeuralDock V2 - Project Learnings

## Critical Debugging Protocols
- **Phase 1 (Archaeology):** Always perform a full diagnostic sweep before editing. Identified CSS absolute positioning as the root cause for overlapping "random text".
- **Theming:** Use CSS variables or a unified `style.css` for the V2 dark-gold theme (`#d4a853`).

## Frontend Architecture
- **Puter.js Integration:** Successfully refactored `js/voice.js` to use `puter.ai.txt2speech` with the OpenAI provider as the default for high-fidelity V2 audio.
- **Component Reconstruction:** Rebuilt Voice Studio, Chat, IDE, and Image Generation panels to match a unified high-contrast aesthetic.

## Verification Patterns
- **Playwright Screenshots:** Use automated verification scripts to capture multi-state UI (Login -> Chat -> Voice) for rapid visual confirmation in headless environments.
