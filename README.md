# Clamworks Lab 🐚

A community-made **Legends of Idleon** Clamworks / Scurgeworks progression planner, styled to match Sushi Station Lab.

**Goal:** Reach Worker Class 12 as efficiently as possible, then transition to future-content preparation.

## Current prototype (v0.2 — combined allocation planner)

- Import **Idleon Toolbox JSON** or **raw game-data JSON** from a local file or pasted text.
- View current Worker Class, Scurge Level, pearl balance and the Scurgeworks upgrade allocation.
- Track the milestones remaining until Worker Class 12.
- Preserve existing point allocations without assuming a refund.
- Use the Idleon-style abbreviations: **M, B, T, Q, QQ**, then **e21** and higher.
- Use the fictional demo account to preview the UI.
- **Allocation Planner** compares the next promotion against saving immediately, buying pearl upgrades, and assigning unspent Scurge Points.
- Show promotion cost, success chance, expected attempts and expected pearls to earn, including existing balance.
- Compute break-even prices for a single pearl-production upgrade. Estimate discounted multi-purchase paths (up to three purchases), including Frugality and Anti Inflation.
- Allow observed pearl-production rate input for ETA, and in-game next-upgrade price input for cost calibration.

**Important:** Recommendations are **provisional**. The game save does not include the full Clamworks price-growth constants, so exact next-upgrade prices must be entered from the game. Until relevant prices are supplied, the planner does not claim a global best purchase. The present search models at most three further pearl purchases within **the current promotion**, and assumes a constant kill rate; Clam Comrades, Multi-Scalping, future Scurge EXP leveling, and post-promotion reset cycles require character-specific combat modeling. Calibrations are kept in browser memory and are cleared on a changed import. Available Scurge Points are estimated as Scurge level minus allocated points.

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

1. Verify price-growth constants and model the character-specific pearl/Scurge EXP kill rates for Clam Comrades, Multi-Scalping and Self Affliction.
2. Expand the bounded purchase-sequence search into a stronger promotion-cycle optimizer.
3. Simulate the progression across repeated promotions, including upgrade resets, to **Worker Class 12**.
4. Add post-Class-12 progression and future-content preparation.

Unofficial fan project; not affiliated with the developer of Legends of Idleon.
