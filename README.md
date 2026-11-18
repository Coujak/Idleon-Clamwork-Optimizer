# Clamworks Lab 🐚

A community-made **Legends of Idleon** Clamworks / Scurgeworks progression planner, styled to match Sushi Station Lab.

**Goal:** Reach Worker Class 12 as efficiently as possible, then transition to future-content preparation.

## Current prototype (v0.3 — verified game-data upgrade costs)

- Import **Idleon Toolbox JSON** or **raw game-data JSON** from a local file or pasted text.
- View current Worker Class, Scurge Level, pearl balance and the Scurgeworks upgrade allocation.
- Track the milestones remaining until Worker Class 12.
- Preserve existing point allocations without assuming a refund.
- Use the Idleon-style abbreviations: **M, B, T, Q, QQ**, then **e21** and higher.
- Use the fictional demo account to preview the UI.
- **Allocation Planner** compares the next promotion against saving immediately, buying pearl upgrades, and assigning unspent Scurge Points.
- Show promotion cost, success chance, expected attempts and expected pearls to earn, including existing balance.
- Compute break-even prices for a single pearl-production upgrade. Estimate discounted multi-purchase paths (up to three purchases), including Frugality and Anti Inflation.
- Calculate **all nine Clamworks next-upgrade prices automatically** using built-in game-data multipliers, the current Worker Class, account upgrade levels and discount effects. Observed pearl-production rate remains optional for ETA.

**Game-data cost accuracy:** The Clamworks formula is based on `Thingies.Clam_Cost`, using `generalSpelunky[29]` for the nine growth rates and `generalSpelunky[28]` for bonus values. These are published in [Idleon Toolbox's game-data bundle](https://github.com/Morta1/IdleonToolbox) and implemented in both [Idleon Toolbox's Clamworks parser](https://github.com/Morta1/IdleonToolbox/blob/main/parsers/world-7/clamWork.ts) and [Corgan's calculator](https://github.com/Corgan/idleon-research-optimizer/blob/main/js/stats/systems/w7/clamworks.js). Next-level costs have been verified against all nine live-game reference prices from [Idleon Toolbox's test](https://github.com/Morta1/IdleonToolbox/blob/main/__test__/parsers/live-verified-clam-work.test.js). No manual price inputs are required.

**Important:** Although the purchase **costs** are now validated, recommendations remain **provisional**. The present search examines at most three pearl purchases within the current promotion and holds character-specific kill rate constant; Clam Comrades, Multi-Scalping, future Scurge EXP leveling and post-promotion reset cycles require further modeling. Available Scurge Points are estimated as Scurge level minus allocated points.

## Enable GitHub Pages

1. Open the repository's **Settings**.
2. Select **Pages** in the sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose **`main`** and **`/(root)`**, then **Save**.
5. After GitHub finishes deploying, visit:
   **https://coujak.github.io/Idleon-Clamwork-Optimizer/**

The website is static: `index.html`, `planner.js` and `planner.css` live in the repository root. No build step is required.

## Privacy

Imported saves are parsed **locally in the browser**. The public repository contains no personal account export, credentials or real-account demo values.

## Development roadmap

1. Model character-specific pearl/Scurge EXP kill rates for Clam Comrades, Multi-Scalping and Self Affliction (price-growth constants are already verified).
2. Expand the bounded purchase-sequence search into a stronger promotion-cycle optimizer.
3. Simulate the progression across repeated promotions, including upgrade resets, to **Worker Class 12**.
4. Add post-Class-12 progression and future-content preparation.

Unofficial fan project; not affiliated with the developer of Legends of Idleon.
