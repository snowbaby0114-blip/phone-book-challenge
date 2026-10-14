# Phone Book — EyeCarePro Tech Challenge

A small phone book application: an ASP.NET Core API, an Angular front end and a
PostgreSQL database. We built it to look like a real codebase you might inherit — some
of it is unfinished, some of it is questionable, and some of it is simply broken. That
is deliberate.

Your job is to work through the **[Tasks](#tasks)** below and write your answers in a
new `ANSWERS.md` file.

## Before you start

**How much time.** Aim for **4–6 hours** of focused work, spread across **one week** of
calendar time. It is not all-or-nothing: if you run short, or you want to finish
something off properly, just ask for more time — send that request to the recruiter or
HR contact who passed you this challenge, **on or before the last day**.

**Using AI assistants.** Go ahead — use whatever you use at work. We only ask that you
tell us in `ANSWERS.md` what you used and where. What we care about is the quality of
the result and that **you own it**: if you are shortlisted, we will invite you to a
walkthrough where the app is expected to run and where we will ask you to reason about
your changes, including any an assistant wrote for you. Code you cannot explain is the
problem — the tool is not.

**Not expected.** Automated tests (see the note in [Troubleshooting](#troubleshooting) —
the existing test suite does not currently compile), deployment, CI, or production
hardening. Focus on the tasks.

**Git.** This is a git repository whose history has been squashed to a single
`Initial commit`. Commit as you go or once at the end — we will not nitpick timing or
size, but how you group your work tells us something about how you think.

## Prerequisites

| Tool | Version | Check it |
|---|---|---|
| Docker + Compose v2 | any current release | `docker compose version` |
| .NET SDK | 8, 9 or 10 | `dotnet --list-sdks` |
| `dotnet-ef` CLI | matching your SDK | `dotnet ef --version` |
| Node.js | 20 (18 also works) | `node --version` |

The project targets `net8.0` but builds on newer SDKs. Node is pinned via
[Volta](https://volta.sh/) if you use it; `nvm use 20` is fine too.

Install the Entity Framework CLI if you do not have it — you need it for step 2:

```bash
dotnet tool install --global dotnet-ef
```

## Running it

### 1. Database

From the repository root:

```bash
docker compose up -d --wait
```

That starts PostgreSQL 16 on **port 9445** in a container named `phone-book-postgres`.
`--wait` blocks until the database reports healthy — without it the next step can run
before PostgreSQL is accepting connections.

### 2. Backend

```bash
cd backend/PhoneBookAPI
dotnet ef database update    # creates the schema and seeds sample data
dotnet watch run
```

The API listens on **<http://localhost:5297>**, with Swagger at
**<http://localhost:5297/swagger>**.

### 3. Web UI

In a second terminal, from the repository root:

```bash
cd webui
npm ci
npm start
```

Open **<http://localhost:4555>**.

### Signing in

The database is seeded with one account:

| Email | Password |
|---|---|
| `admin@example.com` | `123456` |

**Use it.** The seeded contacts and message history belong to that account, so if you
register a fresh user instead you will be looking at an empty Contacts screen with
nothing to style or paginate. You are welcome to register a second account to test the
sign-up flow.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `A compatible .NET SDK was not found` | no .NET 8/9/10 SDK on your PATH | `dotnet --list-sdks`, then install one |
| `dotnet ef` — command not found | the EF CLI is a separate tool | `dotnet tool install --global dotnet-ef` |
| `docker-compose: command not found` | Compose v1 is retired | use `docker compose` (no hyphen) |
| Port 9445 / 5297 / 4555 already in use | something else is bound | stop the other process. Changing a port is possible but touches more than one file — each of the three is referenced in several places, so freeing the port is much less work |
| Requests from the UI fail with a CORS error | the API only allows `http://localhost:4555` | serve the UI on 4555, or edit the policy in `Program.cs` |
| Browser warns about the HTTPS certificate | dev certificate not trusted | `dotnet dev-certs https --trust` (or just use the HTTP URL) |
| `npm run build` logs `localStorage is not defined` | server-side rendering is enabled and some code assumes a browser | non-fatal — the build still succeeds. Worth thinking about, though |
| `npm test` fails immediately | the checked-in test suite does not compile | out of scope for this challenge; ignore it or fix it if you like |
| Need a clean database | data lives in a Docker volume | `docker compose down -v && docker compose up -d --wait`, then `dotnet ef database update` |

## Tasks

Some tasks are about design and layout, some are full-stack features, and some are about
judgement. They cover both maintaining code you did not write and adding new things.

Install any packages you want, on either side of the stack.

### UI

1. **Improve the layout of the Login and Register screens.** The previous developer
   applied no styles at all.
2. **Improve the layout of the Contacts screen.** It currently has what we will
   generously call basic styling.
3. **Make the Navbar mobile-friendly.** It is static today.
4. **Make the Profile forms stacked.**
5. **Replace the "Send Message" prompts with something modern.** It currently uses
   browser `prompt()` dialogs — and while you are in there, work out why sending a
   message does not appear to do anything.

### Full-stack

1. **Wire up the Profile page.** It does not call the backend at all right now.
2. **Build the History page** so it shows the logged-in user's message history.
   Implement it however you think best.

### System design

Answer these in `ANSWERS.md`:

1. What do you think of the app in general?
2. What struck you in the code as worth improving?
3. What HTML/CSS changes would make this nicer to use and to work on? Did you make any
   of them while doing the tasks?

## Your answers

Create an `ANSWERS.md` in the repository root. This structure keeps us honest when we
read it:

```markdown
# Answers

## AI assistance
What I used, and where.

## UI tasks
Notes per task — decisions, trade-offs, anything unfinished.

## Full-stack tasks
Notes per task, including anything you found broken along the way.

## System design
1. What do you think of the app in general?
2. What struck you in the code as worth improving?
3. What HTML/CSS changes would make this nicer to use and to work on?

## About the challenge
1. What did you think of it?
2. How could we improve it?
3. Was it easy to get started — environment setup and all that?

## Anything else
```

The last section is genuinely for us, not for you: it does not affect your evaluation.
We would rather fix a bad challenge than keep running it.

## Submitting

From the repository root:

```bash
bash scripts/delivery.sh                                    # macOS / Linux
pwsh scripts/delivery.ps1                                   # Windows, PowerShell 7+
powershell -ExecutionPolicy Bypass -File scripts\delivery.ps1   # Windows PowerShell 5.1
scripts\delivery.cmd                                        # Windows, double-click
```

On Windows, `scripts\delivery.cmd` is the simplest route: `pwsh` only exists if you
installed PowerShell 7, and the built-in Windows PowerShell 5.1 refuses to run unsigned
scripts unless you pass `-ExecutionPolicy Bypass` as shown.

It asks for your name and produces `yourname_delivery_<timestamp>.zip` containing your
work **and your git history**. Dependencies and build output are excluded
automatically, so the file stays small — you do not need to clean anything up first.

Email that zip back to us. If the zip is awkward to send, invite
**tech.challenge@eyecarepro.net** to a private repository on GitHub or GitLab instead.

## What happens next

We review your submission. Shortlisted candidates are invited to a walkthrough call
where you run the app and talk us through your changes.

## Disclaimer

- This is not an MVP, product, or anything we will commercialise, distribute, sell or
  otherwise directly profit from.
- We may fold feedback and improvements into future versions of this challenge — some of
  them may be yours.
