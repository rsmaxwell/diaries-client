# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Angular features and services (e.g., `diaries/`, `dayview/`, `fragment/`, `headers/`, `mqtt/`, `model/`, `utilities/`). Routes in `src/app/app.routes.ts`; app config in `src/app/app.config.ts`.
- `src/environments`: `environment.ts` and `environment.development.ts` for build-time flags.
- `public/assets`: static assets and runtime config (`public/assets/config.json`).
- `src/styles.scss`, `src/styles/constants.scss`: global styles and variables.
- Tests colocated as `*.spec.ts` next to source files.

## Build, Test, and Development Commands
- `npm start` (or `ng serve`): Run the dev server at `http://localhost:4200/` with live reload.
- `npm run build` (or `ng build`): Production build to `dist/`.
- `npm run watch`: Development build in watch mode.
- `npm test` (or `ng test`): Run unit tests with Karma/Jasmine; add `--code-coverage` for reports.
- `ng generate component|service|pipe <name>`: Scaffold Angular artifacts (e.g., `ng g component fragment/text-panel`).

## Coding Style & Naming Conventions
- TypeScript + Angular 20; SCSS for styles.
- Indent with 2 spaces; UTF‑8; trim trailing whitespace; ensure final newline; use single quotes in `.ts` (see `.editorconfig`).
- File/folder names: kebab-case. Components end with `.component.ts/.html/.scss`; services `.service.ts`; models in `src/app/model/` use PascalCase types.
- Prefer Angular DI, RxJS, and HttpClient; avoid direct DOM access.

## Testing Guidelines
- Framework: Jasmine + Karma. Test files named `*.spec.ts` and colocated.
- Use `TestBed` for components; mock services and keep tests deterministic.
- Coverage via `karma-coverage` (output under `coverage/`). Aim to maintain or increase coverage on changed code.

## Commit & Pull Request Guidelines
- Commits: imperative mood and focused (e.g., `fragment: fix re-ordering issue`). Group related changes.
- PRs: clear description, linked issues (`Fixes #123`), screenshots/GIFs for UI changes, and steps to test. Note config impacts to `assets/config.json` or environments.

## Security & Configuration Tips
- Do not commit secrets. Runtime endpoints and MQTT settings are read from `public/assets/config.json` via `ConfigService`; do not hardcode URLs/credentials.
- Use `src/environments/*` only for non-secret build flags. Keep sensitive values external or injected at deploy time.

## Architecture Notes
- Standalone Angular components with router-based navigation.
- The client communicates with `diaries-responder` primarily through MQTT RPC and retained MQTT live-object subscriptions.
- HTTP is used only where appropriate for static files, runtime configuration, or browser-served resources.
- UI uses Angular Material and Quill.
- Keep client behaviour consistent with the responder, especially around request/reply payloads, retained topic names, locking, deletion, and idempotency.

