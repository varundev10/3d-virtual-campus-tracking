# Notes for contributors and coding agents

## Merges and the UI

Frontend UI files belong to the ui/futuristic-redesign work. In merges, keep our UI and only take functional/logic changes from upstream. Always diff against the pre-merge commit before finishing a merge.

In practice: before committing a merge, compare the result with the commit you were on (`git diff <pre-merge-commit> -- tracking-frontend/src`, or `git diff HEAD` while the merge is still uncommitted) and confirm that every difference in the UI files is an upstream functional change, not a lost screen.

`npm run lint` in `tracking-frontend` also runs `scripts/check-ui.mjs`. It fails if the sign-in page stops rendering the campus mini map, the dashboard stops rendering the site plan (with its greeting, both buttons and quick actions), or the campus-buildings data (`src/lib/campus-buildings.js`) is missing, malformed, outside the campus boundary, out of step with the backend seed in `DataInitializer.java`, or has fewer than 10 entries once it is no longer marked provisional.

## Campus data

The campus's places live in `tracking-frontend/src/lib/campus-buildings.js` and are mirrored in `tracking-backend/.../config/DataInitializer.java`; change both together (the check compares them). The list is provisional: it holds the five named UCER places that OpenStreetMap has, and the A-D blocks and other facilities still have to be added. OpenStreetMap data is © OpenStreetMap contributors (ODbL).
