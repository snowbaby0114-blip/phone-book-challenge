# Answers

## AI assistance

I used two AI assistants, for different things.

**GPT, for guidance and planning.** I used it to investigate the project and to understand what the README asks for.

- **Reading and planning.** It read the whole codebase and the README and produced the list of defects and the design below.
- **Implementation.** It wrote the code. The shared front-end foundation (models, session service, HTTP interceptor, guards, API client, routes, design tokens and the reusable data grid) was written first in the main session. The backend, the navbar and auth screens, Contacts with the send dialog, History, and Profile were then drafted as separate slices by parallel sub-agents against that foundation.
- **Review and fixes.** Everything was read back and exercised in the main session, which found and fixed real defects. For example, the grid's mobile layout was broken because Material creates the `<tbody>` itself and component-scoped CSS never reaches it, and `describeError` would have shown raw 5xx titles or HTML bodies to users.
- **Tests.** It repaired the checked-in Angular specs (they did not compile) and wrote the unit tests described under "Anything else".
- **Verification.** It stood up the full stack locally and drove it with throw-away Playwright, axe-core and API scripts. Exhaustive testing of the API found a real bug that nothing else had: any NUL character in any text input caused a 500. See "Anything else" for exactly what was and was not run.

Where things live, so the walkthrough is easy to follow:

| Concern | Files |
|---|---|
| Shared front-end foundation | `webui/src/app/config/tokens.ts`, `services/session.service.ts`, `services/api.service.ts`, `services/auth-guard.service.ts`, `interceptors/api.interceptor.ts`, `utils/http-error.ts`, `models/*`, `app.routes.ts`, `styles.scss` |
| Reusable grid (client and server mode) | `webui/src/app/shared/data-grid/*` |
| Backend | `backend/PhoneBookAPI/Controllers`, `Models`, `Services`, `Extensions`, `Filters`, `Program.cs` |
| Unit tests | the `*.spec.ts` files next to the code they test; run with `npm run test:ci` in `webui` |

## UI tasks

### 1. Login and Register

- Centered card on the design tokens in `styles.scss`, Material outline fields, inline validation messages, a password show/hide toggle, a spinner on the submit button, and a full-width primary action.
- The form stays mounted while submitting (controls are disabled) instead of being swapped for an "Authenticating..." div as before, so nothing is lost on a failed attempt.
- API failures are shown in a `role="alert"` block using the server's own message. A failed login is a 401 whose detail is "Invalid email or password".
- `?returnUrl=` is honoured after login, but only for in-app paths (starts with a single `/`, no `//`, no `://`).
- Register has Name and Surname side by side from 480px up, a password with a 6-character minimum (the same rule the API enforces) and a confirm field. On success it shows a snackbar and goes to `/login`. I did not auto-sign-in, to keep the API contract unchanged. That is a trade-off.
- Bugs found and fixed here:
  - Login navigated to `/`, which had no route, so the user landed on a blank page after signing in. There is now a default route and a wildcard route.
  - Name and Surname inputs were `type="email"`.
  - The register button said "Login".
  - The register handler logged "Login failed" on success.

### 2. Contacts

- The old grid was rebuilt as a reusable `app-data-grid` on `MatTable`: sorting, a search box, pagination, and loading, empty and error states with retry. Rows can use a projected cell template, and there are row actions. The grid is generic over the row type, so the compiler checks the columns, actions and data together.
- Below 600px the table becomes stacked cards and the hidden header is replaced by a "Sort by" select, so sorting still works on a phone.
- Bugs found and fixed:
  - The Phone column was blank: the grid looked up `item['phone']` but the API sends `phoneNumber`.
  - `track item[0]` meant nothing was tracked.
  - Headers were lower-cased and used as property names, which also hid the surname.
- Contacts paginate client-side because the endpoint returns the whole address book, which is small. The grid also has a server-side mode, which History uses. Contacts would move to it if address books grew.
- Each row has two actions: Message, and History, which opens History pre-filtered to that contact.

### 3. Navbar

- Sticky Material toolbar with a real `<nav aria-label="Main">`. From 768px up the links are inline. Below that they collapse into a hamburger button with a `mat-menu` carrying the same destinations plus Sign out. The switch is pure CSS, so server and client render the same markup.
- It is auth-aware. Guests see Sign in and Create account. Signed-in users see Contacts, History, Profile, their name and Sign out. The active link is highlighted and gets `aria-current`.
- The navbar is excluded from hydration (`ngSkipHydration`) on purpose: it depends on the browser-only session, and the server always renders the guest variant.
- The dead hidden `mat-nav-list` with inline styles is gone.

### 4. Profile forms stacked

One column at every width: two cards stacked vertically ("Personal details", then "Change password"), every field stacked full width, and actions at the bottom (full-width buttons on small screens).

### 5. Send Message

- The `prompt()` calls are replaced by a `MatDialog`. It has an SMS / Email toggle, a live preview of the destination (phone for SMS, email for Email), a message box with a `n / 1000` counter, validation (required, not whitespace-only), and an in-flight state that blocks closing.
- On failure it stays open, keeps the typed text and shows the error. Ctrl/Cmd+Enter sends. On success it shows a snackbar with a "View history" action.
- **Why sending appeared to do nothing.** There were five independent causes, and any one of them would have hidden the others:
  1. The backend had no `/api/messages` endpoint at all, so every send was a 404.
  2. The client swallowed the failure (`catchError(() => EMPTY)` plus `console.error`) and had no success feedback either, so neither outcome was visible.
  3. It posted `contact_id` (snake case) where ASP.NET binds `contactId`.
  4. The prompt asked for "text or email" but the API values are `SMS` / `Email`.
  5. Cancelling a `prompt()` returned silently without any validation message.

  The old `getMessages` also read `response.messages` and used a model (`contactName`, `createdAt`, `updatedAt`) that did not match the entity.

## Full-stack tasks

### 1. Profile

- Profile and password updates are wired to the API. The form is prefilled from `GET /api/users/me`. Save is enabled only when the form is valid and changed. Success shows a snackbar and refreshes the session, so the navbar shows the new name straight away. Errors appear inline. A Surname field was added because the API requires it.
- **Found broken and fixed in the API:**
  - `UpdateMyProfile` and `UpdateMyPassword` bound their parameters from the **query string**, which would have put passwords into URLs and logs. They now take JSON bodies with validation.
  - `UpdatedAt` was never set on update.
  - A wrong current password returned **401**. The client treats any 401 as an expired session and signs the user out, so a typo would have logged people out. It now returns 400 with a clear message.
  - A successful password change returns 204.
  - Email uniqueness is case-insensitive, the email is normalised, and the auth cookie is re-issued so its name claim follows the new email.
- Passwords are hashed now as well; see "Other things found broken along the way".

### 2. History

- The page shows the signed-in user's messages with a server-side search (debounced; matches the message body and the contact name), filters for contact, type and status, sortable columns (date, contact, type, status), and paging.
- Design reasoning: history grows without bound, so paging, sorting and filtering happen in SQL, and the grid is in server mode.
- The API is `GET /api/messages?page&pageSize&sortBy&sortDirection&type&status&contactId&search`, returning `{ items, total, page, pageSize }`:
  - Always scoped to the current user.
  - Case-insensitive `ILIKE` with the user's `%`, `_` and escape characters escaped.
  - A deterministic tie-break on `Id` so paging is stable.
  - `pageSize` is clamped to 1..100.
  - Out-of-range pages are clamped to the last page.
- `POST /api/messages` validates the body (1..1000 characters, trimmed), checks that the contact belongs to the user (404 otherwise) and creates the message as `Queued`. There is no real SMS or email provider, so `Queued` is the honest initial status. `GET /api/messages/{id}` backs the 201 `Location`.
- Contacts' History action links to `/history?contactId=…`, and the filter follows that query parameter on navigation. A user with no messages sees a friendly empty state rather than an empty table. Responses are processed through `switchMap`, so a stale response can never overwrite a newer one.
- Not done: filters and paging are not mirrored into the URL (only `contactId` is), and there is no export.

### Other things found broken along the way

- **Passwords were stored and compared in plain text.** The login query was `WHERE Password = @input`, and registration and the password change stored whatever the client sent. A new `Services/PasswordService.cs` wraps ASP.NET Identity's `PasswordHasher` (PBKDF2-HMAC-SHA512, 100,000 iterations, a random 16-byte salt per password), and login, registration and change-password all go through it:
  - Existing plain-text rows are recognised by shape (an Identity v3 hash is exactly 61 bytes of base64 starting with `0x01`) and compared in constant time. A successful sign-in rewrites the row as a hash, so the seeded `admin@example.com` / `123456` keeps working and **no migration is needed** (`Password` is a `text` column). A failed attempt never upgrades a row, and the upgrade is not counted as a user edit (`UpdatedAt` is left alone).
  - A value that looks like a hash is never compared as plain text, so a leaked hash cannot be used as a password.
  - An unknown email is verified against a decoy hash, so a missing account costs the same as a wrong password (about 45 ms each on my machine) and the response is identical.
  - Not done: users who never sign in again keep their plain-text row until a one-off job hashes it, and login has no rate limiting.
- **Cookie auth redirected API calls.** ASP.NET's cookie handler answers an unauthenticated `[Authorize]` call from a browser with a 302 to `LoginPath` (`/api/auth/login`, a POST-only endpoint) instead of a 401. It now returns 401 (or 403), and the interceptor signs the user out and returns them to the login page with a `returnUrl`.
- **SSR.** `localStorage` was used at render time, which is the README's `localStorage is not defined`. There was also no default route, so `/` failed in SSR. Fixed with an `IS_BROWSER` token, a `SessionService` that only touches storage in the browser, guards that let the server render an inert shell for protected routes, and all data fetching in `ngOnInit` behind `IS_BROWSER`. Protected pages never fetch on the server. `ng build` now prerenders 5 routes without the error, and the production server (`serve:ssr`) answers every route.
- **Fonts.** `index.html` pulled Roboto and Material Icons from Google at build and run time, and the production `ng build` inlines them and therefore needs internet. I self-host them now (`@fontsource/roboto`, `material-icons`), so the build works offline and there is no third-party request on page load.
- **Response and error handling.** `describeError` turns ProblemDetails, plain strings and network failures into user-facing text, but never shows 5xx bodies, HTML or stack traces.
- **A NUL character in any text input crashed the API with a 500.** PostgreSQL rejects `\u0000` in text, and every string that reaches the database (search, message body, login, registration, profile and contact fields) was exposed. One global action filter (`RejectNullCharactersFilter`) now turns it into the standard 400 validation response for all endpoints. Exhaustive API tests found this; the happy-path checks and the browser could not have.
- **Validation text was too faint to read comfortably.** Material's default error red (#f44336) is only about 3.7:1 against white, below WCAG AA for small text. The theme tokens are overridden with a darker red (about 6.5:1) in `styles.scss`, so every `mat-error` and error-state label benefits.
- **Typing into a server-rendered form before Angular has hydrated it loses the text** (Angular 17 has no event replay). It only matters on a slow first load, and it is one more reason that SSR buys little for an app that is almost entirely behind a login. Disabling SSR would be a reasonable follow-up.
- **Double submits.** Login, Register and the send dialog now ignore a second submit while one is in flight (a disabled Angular form reports itself as valid, so the old `invalid` check alone did not stop it).
- **Dead scaffolding removed:** four empty `*.module.ts` files; the `withHttpTransferCacheOptions({ includePostRequests: true })` setting; and the controllers' unused `ILogger` fields and dead `userIdString != null` branches (replaced by one `User.GetUserId()` extension).

## System design

### 1. What do you think of the app in general?

It is a sensible skeleton: clear separation between controllers, entities and models; EF migrations; standalone Angular components; Material. The shape is right, but the product is thin and a few important things were missing or unsafe:

- The core feature, sending messages, did not exist server-side. Even now there is no provider, queue or delivery lifecycle: `Queued` never moves to `Sent`, `Delivered` or `Read`.
- Authentication is a cookie. The passwords were stored in plain text (fixed, see above) and there is still no brute-force protection.
- Client and server drifted apart because nothing ties them together (snake case versus camel case, `phone` versus `phoneNumber`, a message model that matched no entity). Generating the TypeScript client from the OpenAPI document would remove that whole class of bug.
- The checked-in tests did not compile, so nothing exercised behaviour.

The next things I would build, in order: a unique email index, a one-off job to hash the remaining legacy passwords, a background dispatcher with status webhooks, server-side paging for contacts, rate limiting on login, config via environment, CI with a browser smoke test.

### 2. What struck you in the code as worth improving?

Backend:

- **Plain-text passwords**, stored and compared in the login `WHERE` clause. Fixed (see "Other things found broken along the way"): they are hashed with Identity's `PasswordHasher`, and legacy rows are upgraded transparently on a successful login. What remains is a one-off job to hash the rows of users who never sign in again.
- **No unique index on `Users.Email`.** The duplicate check is check-then-insert and races under concurrency. It needs a migration adding a unique index on the lower-cased email plus handling of `DbUpdateException`. `lower(Email)` comparisons also defeat any index; a `citext` or normalised column is better.
- Cookie `SecurePolicy = None`, a hard-coded CORS origin, credentials in `appsettings.json`, and `AllowedHosts: *`. Fine for local development, but they should come from configuration and secrets. Cookie auth across origins also needs CSRF protection (anti-forgery or `SameSite=None; Secure` with tokens).
- Missing or inconsistent validation and error shapes, and unused injected dependencies (all addressed above for the endpoints I touched).
- Contacts returns everything with no paging.
- No input hardening: a NUL character in any string caused a 500 (fixed with one global filter, see above).

Frontend:

- Auth state was "is there a `last_cookie_update` key in `localStorage`", with no expiry handling and no SSR safety. Now there is a `SessionService` plus an interceptor that reacts to 401.
- `any` everywhere (`Observable<any>`, `tap` used where `map` was meant), an API URL hard-coded in the service (now an injection token; an environment file would be better), and console-only error handling.
- A grid keyed on lower-cased header text. Unused dependencies `apollo-angular` and `graphql-tag`. The checked-in spec files were generated stubs that referenced classes and properties that do not exist (`AuthGuardService`, `AppComponent.title`), so `npm test` did not compile. I replaced them with a real suite (see "Anything else").

### 3. What HTML/CSS changes would make this nicer to use and to work on?

Changes I made:

- **Design tokens and a handful of shared classes** in `styles.scss` (`page`, `card`, `alert`, `chip`, `form-stack`, `auth-*`) instead of ad-hoc per-page styles. Components only carry their own layout, and there are no inline styles.
- **Removed the global `mat-typography` class from `<body>`.** It imposes margins on every `p` and `h1`, which silently beat my own classes. Typography is defined explicitly now.
- **Semantics and accessibility:**
  - Landmarks (`nav aria-label`, `main`, `section aria-labelledby`, `role="search"`).
  - A proper heading order, visible labels on every field, correct `type` and `autocomplete` attributes, `aria-pressed` on toggles, `aria-label` on icon buttons, and `role="alert"` on errors.
  - Table sorting through Material's `aria-sort`.
  - axe-core reports zero violations on login (with an error), register (with validation errors), contacts (including no results), history (including an open select and no matches), profile (with a validation error), the send dialog and the open mobile menu, on desktop and at phone width. It found one real issue, the low-contrast error red, now fixed in the theme.
- **Responsive by default:** no horizontal overflow at 390px on any page (checked), tables become cards below 600px, and the navbar collapses to a menu.
- **Self-hosted fonts and icons** (privacy, offline builds, no layout shift from a CDN swap).
- Per-route page titles, and 6/10kb component-style budgets plus a realistic 750kb initial budget (the original 500kb produced a warning once Material's menu, toolbar and table were in the shell).

What I would still do: a dark theme driven by the same tokens, skeleton loaders instead of spinners, a sticky table header, Stylelint, and Storybook for the grid.

## About the challenge

These answers are based on my actual setup and working experience, not a template.

1. **What did you think of it?** A good "inherit a codebase" exercise: the defects are realistic (a missing endpoint, silent failures, a blank column, a login redirect to a route that does not exist, SSR assumptions) and they interact, so finding all five causes of "sending does nothing" is satisfying. The scope is generous for 4–6 hours if the goal is polish and verification, so deciding what to leave out is part of the exercise. The README says production hardening is not expected, yet I fixed the plain-text passwords because I was already rewriting those endpoints. The unique email index and rate limiting are left as documented follow-ups.
2. **How could we improve it?**
   - State expectations on paging and sorting for Contacts explicitly.
   - Make `npm test` meaningful: the generated specs did not compile (the guard spec imports a class that does not exist), so either fix them or delete them. I rewrote them.
   - Remove the unused `apollo-angular` and `graphql-tag` dependencies.
   - Self-host the fonts, or say that the production build needs internet.
   - Say that the Docker daemon must be running.
   - Add a short rubric describing what "good" looks like for AI-assisted submissions.
3. **Was it easy to get started?** The README steps are accurate and the happy path is short. On my machine two prerequisites were missing: the .NET SDK was not on the PATH and the Docker daemon was not running. I therefore verified with a portable .NET 8 SDK and an embedded PostgreSQL 16 on the same port and credentials (9445, `dev` / `123456789`) rather than `docker compose`. Node 24 worked with Angular 17.2 even though the README recommends 20.

## Anything else

**Unit tests.** `npm run test:ci` in `webui` runs 237 tests in headless Chrome, all passing, in random order, in about five seconds. They give 99.8% statement, 98.2% branch and 100% function coverage of the app code (the one uncovered line is a type-required null guard that the UI cannot reach). I replaced the generated stubs. They cover:

- error mapping (`describeError`), the session (including ignoring malformed stored data), the route guards and the HTTP interceptor;
- the API client (every endpoint and the query-string building);
- the shared grid (client and server modes, sorting, search, paging, loading/empty/error states, cell templates, actions);
- the navbar, Login, Register, Contacts, the send dialog, History (debounce, out-of-order responses, query-parameter sync, paging, sorting, filters, empty and error states) and Profile.

The backend has no test project: adding one means a new project and packages, which felt out of proportion for this challenge. Its behaviour is covered by the API script below instead.

**Verification.** I ran the real stack (the API against PostgreSQL 16 with all three migrations applied, and the Angular app) and drove it with throw-away scripts that are not committed:

- **API, 319 checks on a pristine database.** Every endpoint and branch:
  - auth and cookie attributes, and a 401 on every protected route without a cookie;
  - validation boundaries on every field;
  - every sort field in both directions, with stable tie-breaking across pages;
  - every filter and combination, search escaping (`%`, `_`, `\`) and hostile input, and paging clamps;
  - isolation between users, 20 concurrent sends, CORS, Swagger, and NUL characters.
- **Passwords, 102 more checks that read the stored values straight from PostgreSQL:** the legacy plain-text upgrade on first login (and no upgrade after a failed attempt), salted hashes on registration and change-password, non-ASCII and edge-case passwords, 12 concurrent first logins, a stored hash never accepted as a password, hash-shaped garbage never matched as plain text, and an unknown email costing the same time as a wrong password.
- **Browser: the same 118-check suite passes on Chromium (Edge), Firefox and WebKit (Safari's engine), plus 54 + 19 more checks on Edge.**
  - Navigation: deep links and guards, back and forward, signing out in one tab ending another, and expired sessions.
  - Contacts: sorting, search and paging.
  - Messaging: cancel, Escape, backdrop click, and an SMS and an email.
  - History: through the real select controls, with results checked against the API.
  - Profile persistence, double clicks, and the mobile sort-by control, dialog and menu.
  - SSR output, hydration with no console errors on any route, and axe in many states.
- The browser suites pass against both the dev server and the **production build** (the minified bundle served by the SSR server).
- `ng build` (production) succeeds, prerenders 5 routes and has no warnings. `dotnet build` has 0 errors, and the strict template check is clean.
- **Not run:** `docker compose` itself (the daemon was unavailable here) and physical devices (the mobile layout was checked at 390px in all three engines, not on real phones).

**Running it.** Unchanged from the README: `docker compose up -d --wait`, then `dotnet ef database update` and `dotnet watch run` in `backend/PhoneBookAPI`, then `npm ci` and `npm start` in `webui` (and `npm run test:ci` for the unit tests, which needs Chrome). Sign in with `admin@example.com` / `123456`. There are **no new migrations**, and the seed data and schema are untouched (the seeded admin row keeps its plain-text value until its first sign-in upgrades it to a hash). The only new packages are `@fontsource/roboto` and `material-icons` (self-hosted fonts); the lockfile also shows harmless `peer` metadata churn from a newer npm. The one new script is `test:ci` in `package.json`.

**API changes** (all errors are RFC 9457 ProblemDetails):

| Endpoint | Change |
|---|---|
| `GET /api/messages` | New: paged, sorted, filtered history |
| `GET /api/messages/{id}` | New |
| `POST /api/messages` | New: `{ contactId, type, body }` returns 201 |
| `POST /api/users/me/profile` | Now takes a JSON body (was query string); 409 on duplicate email |
| `POST /api/users/me/password` | Now takes a JSON body; 400 on wrong current password; 204 on success; the new password is stored hashed |
| `POST /api/auth/login`, `/register` | Email normalised; validated models; 401 and 409 as ProblemDetails; passwords hashed, and legacy plain-text rows upgraded on login |
| Protected endpoints | 401 / 403 instead of a 302 redirect |
