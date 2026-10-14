# Phone Book — Web UI

Angular 17 front end, generated with Angular CLI 17.2.2. Server-side rendering is
enabled (`@angular/ssr`).

See the [main README](../README.md) for prerequisites, the database and API setup, and
the challenge tasks.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | install dependencies from the lockfile |
| `npm start` | dev server on <http://localhost:4555> |
| `npm run build` | production build into `dist/` |
| `npm run watch` | rebuild on change, development configuration |
| `npm test` | Karma unit tests — **note: the checked-in suite does not currently compile** |

The API is expected on <http://localhost:5297>; that base URL is currently hardcoded in
`src/app/services/api.service.ts`.

## Scaffolding

`ng generate component <name>` — also `directive`, `pipe`, `service`, `class`, `guard`,
`interface`, `enum`. Run `ng help` or see the
[Angular CLI reference](https://angular.io/cli).
