# Lunar sub-application

The existing robot homepage stays at `/`. The independent React lunar application is in `moon/`, deployed at `/moon/`. Its cockpit entry is `/moon/cockpit/`.

`npm ci` and `npm run build` build the original homepage first, then append the lunar application under `dist/moon/`. No Sites credentials or hosting configuration are included. Lunar assets are under `/moon/content/`; the server-only EdgeOne handler is `/moon/api/command`.

The optional model remains unconfigured by default. EdgeOne environment variables: WORKSHOP_MODEL_ENABLED, WORKSHOP_MODEL_KEY (secret), WORKSHOP_MODEL_BASE_URL, WORKSHOP_MODEL. Local gameplay does not need this API.

`npm test` verifies the original robot application. `node scripts/verify-moon-deployment.mjs` verifies deployment entries after building. The cockpit is a visual study, not yet free-flight gameplay. Previous Sites source and editable Blender files remain in the independent selene-lunar workspace.
