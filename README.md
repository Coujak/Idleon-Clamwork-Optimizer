# Clamworks Lab 🐚

A local-first **Legends of Idleon** Pearl and Scurge progression planner. Import an Idleon Toolbox JSON export, select a character, and decide whether to buy Pearl upgrades or save for your next Worker Class promotion. The long-term goal is Worker Class 12.

## Working features

- **IT JSON import:** reads account upgrade levels, Scurge points, current EXP, characters, class, combat stat snapshots, equipment, saved maps and AFK assignments; nothing is uploaded.
- **Verified costs:** calculates all nine next-level Pearl upgrade costs from game data, including Frugality, Anti Inflation and Scurge discounts, respecting unlock progress and the 25-clam cap.
- **Promotion probabilities:** cost and chance per attempt, plus expected additional Pearls accounting for savings and unsuccessful attempts. Successful promotions reset the temporary Clamworks upgrades.
- **Pearl allocation:** an up-to-16-purchase beam search comparing saving immediately against investing, using a consistent production model. Displays recommended purchase order, break-even prices, and one-buy time effects. This is a heuristic search, not a mathematical proof of optimality.
- **Clam Comrades:** counted via a user-selectable mob-count efficiency scenario; buying more clams does not guarantee proportionally more kills.
- **Multi-Scalping:** included when multikill for each contributing farming source is known; otherwise omitted from the recommendation.
- **Scurge allocation:** the default Pearl-farming objective now evaluates Pearl Infection, Cost Dissolving, Cross Culting and (when unlocked) True Scurge using the same next-promotion spending model. Alternative modes prioritize pure Pearl income, Scurge EXP, purchase discounts or a balanced heuristic. Only unspent points are assigned; existing levels remain unchanged. Extra Self Affliction requires verified damage. Promotion scoring uses a bounded heuristic and currently considers up to 12 free points per calculation.
- **Next Scurge Point:** previews the best allocation after the next level, including a table comparing each unlocked Pearl-value or cost-discount option by its modeled effect on next-promotion time. For example, Cross Culting cannot lower Encystation Up costs while Gravestart is Lv0.
- **Scurge EXP:** computes EXP per actual Clamworks kill, current level progress, nearby-player Swarming input, and calibrated level-up ETA when kills/hour are known.
- **Pearl versus Scurge:** with separate observed Pearl/AFK/Scurge rates, compares spending time on the next Pearl-value Scurge Point against farming the promotion; when Scurge EXP/hour is missing, it can show the minimum required EXP/hour.
- **Character audit:** automatically displays saved combat inputs, sourced multikill contributions, Clamworks enemy HP, World 7 overkill math, and the Self Affliction damage penalty. Off-map damage estimates are explicitly provisional.
- **AFK reroll:** an optional analytic keep-Pure/reroll-misses comparison, including different replacement-claim reward distributions and auto-claim disabling rerolls.

## How to use

1. Import the latest IT JSON using the file uploader or paste.
2. In the Allocation Planner, choose your active farming character and objective. Enable other Clamworks AFK characters if applicable.
3. Review the primary Invest or Save recommendation and its ordered Pearl purchase plan. Re-import after upgrading or successfully promoting.
4. Select a realistic Clam Comrades scaling scenario. The default is conservative.
5. Add observed active Pearl/hour and total AFK Pearl/hour for absolute ETA. Add observed Scurge EXP/hour to assess whether earning your next Scurge point is worthwhile.
6. Leave the Scurge objective on Automatic for a next-promotion comparison that weighs Pearl Infection against Cost Dissolving and Cross Culting, or choose one of the narrower Pearl, EXP, discount or balanced modes.

## Model limitations

| System | Status |
| --- | --- |
| Next-level Pearl costs | Validated against public live-game references |
| Scurge bonuses, promotion probability, current progress | Game-formula calculations |
| Pearl upgrade comparisons | Relative production with an up-to-16-buy heuristic |
| Clam Comrades | Scenario model; actual extra kills depend on combat |
| Multi-Scalping | Requires known multikill for participating characters |
| Complete automatic character damage and native combat kills/hour | Not implemented |
| Native AFK reward generation, food, claim eligibility and reroll distribution | Not implemented; manual what-if model only |
| Worker Class 9 through 12 aggregate ETA | Milestones only; post-reset combat rates aren't predicted |

Raw IT JSON does not contain final recalculated damage or true physical kills/hour. Reproducing them requires the full account-wide stat and combat engine. The app deliberately refuses to claim exact timing from missing inputs. The Pearl versus Scurge comparison assumes the AFK roster stays the same and that gaining one Pearl-value point does not change physical combat throughput.

## Tests

Node.js 22 is recommended. Run:

    node --test tests/*.test.mjs

The GitHub Actions workflow runs regression tests on pushes and pull requests. Synthetic fixtures only; no personal save files are committed.

## Source references

- [Idleon Toolbox Clamworks formulas](https://github.com/Morta1/IdleonToolbox/blob/main/parsers/world-7/clamWork.ts)
- [Idleon Toolbox combat formulas](https://github.com/Morta1/IdleonToolbox/blob/main/parsers/damage.ts)
- [Corgan calculator architecture](https://github.com/Corgan/idleon-research-optimizer) — educational review only; its restrictive license does not permit copying code into this project.
- [Clamworks gameplay guide](https://www.digitaltq.com/wiki/idleon/the-clamworks)

## Deployment

Clamworks Lab is a static site. Configure GitHub Pages under **Settings → Pages → Deploy from a branch → main → /(root)**.

Expected URL: https://coujak.github.io/Idleon-Clamwork-Optimizer/
