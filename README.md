# Clamworks Lab 🐚

A community-made **Legends of Idleon** Clamworks / Scurgeworks progression planner, styled to match Sushi Station Lab.

**Goal:** Reach Worker Class 12 as efficiently as possible, then transition to future-content preparation.

## Current prototype (v0.5 — character combat-stat audit)

- Import **Idleon Toolbox JSON** or **raw game-data JSON** from a local file or pasted text.
- View current Worker Class, Scurge Level, pearl balance and the Scurgeworks upgrade allocation.
- Track the milestones remaining until Worker Class 12.
- Preserve existing point allocations without assuming a refund.
- Use the Idleon-style abbreviations: **M, B, T, Q, QQ**, then **e21** and higher.
- Use the fictional demo account to preview the UI.
- **Allocation Planner** compares the next promotion against saving immediately, buying pearl upgrades, and assigning unspent Scurge Points.
- Show promotion cost, success chance, expected attempts and expected pearls to earn, including existing balance.
- Compute break-even prices for a single pearl-production upgrade. Estimate discounted multi-purchase paths (up to three purchases), including Frugality and Anti Inflation.
- Calculate **all nine Clamworks next-upgrade prices automatically** using built-in game-data multipliers, the current Worker Class, account upgrade levels and discount effects.
- Track **Royal Guard active pearl farming**, **Arcane Cultist active Scurge EXP**, and the separate aggregate of all AFK character claims. The active focus selector never adds both active rates simultaneously.
- **Character selector** imports names, class IDs, combat stat snapshots, AFK targets, current maps and activity timestamps from IT JSON. Select any character; `coumine2` is the initial selection when present, otherwise use the most recently active character. Pearl/Scurge focus and inclusion of other Clamworks AFK characters are controllable.
- Compute **game-formula expected pearls per kill**, including regular/Pure Pearl chance, Lucky Day, Multi-Scalping, all pearl value effects, and Scurgeworks bonuses for each selected character. A companion EXP multiplier from known Scurge bonuses is shown separately.
- **World 7 combat math**: compute Clamworks HP from Worker Class, overkill tier from calibrated max damage, W7 diminishing-returns curves for raw multikill base/per-tier, and resulting total MK. The selected character's automatically derived MK drives Multi-Scalping in pearl yield. An observed total MK may override these components.
- **Scurge EXP projection**: read current EXP, level and allocation from the IT JSON, derive EXP needed for the next Scurge level, EXP gained per actual Clamworks kill, optional real nearby-player Swarming bonus and ETA when kills/hr is supplied. Scurge EXP does not assume the other AFK characters grant active kills.
- **Automatic combat-stat audit (new)**: import all characters' saved STR/AGI/WIS/LUK, class/main stat, active map, equipped weapon item and enhancement power, assigned cards, talent counts, Self Affliction level, and directly verifiable W3 Death Note building multikill-base component (`2 × Tower[2]`). This source is shown independently of the complete multikill and damage fields, with an explicit missing-components list.
- **Damage map reconciliation (new)**: optional max-damage observations from a non-Clamworks map may be adjusted for the known `/100^SelfAffliction` factor; these projections are labeled **provisional** and cannot silently unlock pearl/hour calculations. Damage observed on Clamworks is not divided again.
- **Combat limitation**: Raw IT JSON contains per-character stats/equipment/talents but not final recalculated character max damage, raw MK base/per-tier or actual kills/hour. Completing these still requires an independent, account-wide combat-stat calculator and active/AFK simulator; this release does not invent them. AFK roster coverage and optional observed aggregate rates remain explicit.

- Compare a simplified **keep-Pure-Pearls, reroll misses** AFK policy against accepting the first claim. Imported `OptLacc[527]` sets the auto-claim checkbox when available.

**Game-data cost accuracy:** The Clamworks formula is based on `Thingies.Clam_Cost`, using `generalSpelunky[29]` for the nine growth rates and `generalSpelunky[28]` for bonus values. These are published in [Idleon Toolbox's game-data bundle](https://github.com/Morta1/IdleonToolbox) and implemented in both [Idleon Toolbox's Clamworks parser](https://github.com/Morta1/IdleonToolbox/blob/main/parsers/world-7/clamWork.ts) and [Corgan's calculator](https://github.com/Corgan/idleon-research-optimizer/blob/main/js/stats/systems/w7/clamworks.js). Next-level costs have been verified against all nine live-game reference prices from [Idleon Toolbox's test](https://github.com/Morta1/IdleonToolbox/blob/main/__test__/parsers/live-verified-clam-work.test.js). No manual price inputs are required.

**AFK reroll note:** Rerolls replace AFK claim rewards rather than doubling them. Corgan's [Clamworks AFK calculator](https://github.com/Corgan/idleon-research-optimizer/blob/main/js/stats/systems/w7/clamworks-afk.js) accounts for offer chance, auto-claim, food and replacement distributions. Our current quick calculator uses manually supplied estimates and assumes identical replacement claims; per-character kill-based projections likewise omit the native claim replacement distribution. Neither is yet equivalent to the native AFK worker or incorporated into the optimal-spending solver.

**Important:** Although the purchase **costs** are now validated, recommendations remain **provisional**. The present search examines at most three pearl purchases within the current promotion and uses a simplified production proxy for purchase rankings, even when character-specific ETA rates have been calibrated; Clam Comrades, Multi-Scalping, future Scurge EXP leveling effects on recommended point allocation and post-promotion reset cycles require further modeling. Available Scurge Points are estimated as Scurge level minus allocated points.

## Enable GitHub Pages

1. Open the repository's **Settings**.
2. Select **Pages** in the sidebar.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose **`main`** and **`/(root)`**, then **Save**.
5. After GitHub finishes deploying, visit:
   **https://coujak.github.io/Idleon-Clamwork-Optimizer/**

The website is static: `index.html`, `planner.js`, `combat-math.js`, `combat-stats.js`, `farming.js`, and `planner.css` live in the repository root. No build step is required.

## Privacy

Imported saves are parsed **locally in the browser**. The public repository contains no personal account export, credentials or real-account demo values.

## Development roadmap

1. Derive native character-specific active/AFK kill rates and total multikill from the complete combat formula; use them to evaluate Clam Comrades and Multi-Scalping purchases instead of asking for observed calibration inputs.
2. Expand the bounded purchase-sequence search into a stronger promotion-cycle optimizer.
3. Simulate the progression across repeated promotions, including upgrade resets, to **Worker Class 12**.
4. Add post-Class-12 progression and future-content preparation.

Unofficial fan project; not affiliated with the developer of Legends of Idleon.
