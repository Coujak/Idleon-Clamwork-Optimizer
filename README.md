# Clamworks Lab 🐚

A community-made **Legends of Idleon** Clamworks / Scurgeworks progression planner, styled to match Sushi Station Lab.

**Goal:** Reach Worker Class 12 as efficiently as possible, then transition to future-content preparation.

## Current prototype (v0.1)

- Import **Idleon Toolbox JSON** or **raw game-data JSON** from a local file or pasted text.
- View current Worker Class, Scurge Level, pearl balance and the Scurgeworks upgrade allocation.
- Track the milestones remaining until Worker Class 12.
- Preserve existing point allocations without assuming a refund.
- Use the Idleon-style abbreviations: **M, B, T, Q, QQ**, then **e21** and higher.
- Use the fictional demo account to preview the UI.

**Important:** The purchase optimizer and time-to-promotion simulation are **not implemented yet**. Current displays describe account state, not mathematically validated recommendations. Available Scurge Points are an estimate based on level minus allocated upgrade points.

## Enable GitHub Pages

1. Open the repository's **Settings**.
2. Select **Pages** in the sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose **`main`** and **`/(root)`**, then **Save**.
5. After GitHub finishes deploying, visit:
   **https://coujak.github.io/Idleon-Clamwork-Optimizer/**

The entire prototype is the root `index.html`; no build step is required.

## Privacy

Imported saves are parsed **locally in the browser**. The public repository contains no personal account export, credentials or real-account demo values.

## Development roadmap

1. Verify Clamworks and Scurgeworks mechanics against current game data.
2. Model pearl production, upgrade costs, EXP/kill and promotion requirements.
3. Optimize purchase sequences to minimize expected time to **Worker Class 12**.
4. Add post-Class-12 progression and future-content preparation.

Unofficial fan project; not affiliated with the developer of Legends of Idleon.
