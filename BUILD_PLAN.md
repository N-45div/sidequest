# SideQuest delivery plan

Hosting: Render. Independent project; do not reuse Spatialize or Parallel.
Commit limit: fewer than 500 inserted lines per commit, including lockfiles.
Submission deadline: October 5, 2026, 12:29 PM IST.

## Current scope

Make a group outing happen without publishing each person's exact spending limit or requirements. Create an outing, invite friends, save private preferences, find feasible options, vote, confirm and download an IST-aware calendar entry.

The user chose a hypothetical persona. Fictional sample people and prices remain labelled; no real recipient or feedback is claimed. The challenge's real-person story remains outstanding. Hardware and Arduino sponsor work are excluded from the active delivery scope at the user's request.

## Feasible release priorities

1. Completed: public Render frontend/API deployment and live flow verification.
2. Completed: Atlas connection, independent host/guest privacy checks, persistence across redeployment; temporary preview disabled.
3. Keep Mastra discovery, deterministic constraint checks and typed controls working. The optional Gemma interpreter requires a real endpoint and reviewed drafts before saving.
4. Retain executed Temporal recovery, Tinker experiment and GitHub Actions evidence. Do not equate the tiny synthetic model evaluation with production reliability.
5. Test mobile interaction, errors, provider outages, stale results, authorization and calendar output on the deployed service.
6. Finish screenshots/demo material and the DEV draft, updating only claims supported by executed evidence.

## Conditional integrations

SerpApi live venues are verified on Render. Gemma inference, ElevenLabs voice, Sentry cloud tracing, Tiger Data retrieval, Backboard model comparison and DigitalOcean inference stay optional until the relevant credentials, account access or compute are supplied. TabPFN additionally needs consented real historical data. Entire is the last sponsor in the active checklist: its local CLI/hooks are installed, but capture needs hook trust review and an actual safely shareable session. None blocks the core sample release.

Current implementations and evidence are recorded in SPONSORS.md. Only verified uses should appear as prize-category claims. A setup file or SDK import is not execution evidence.

## Architecture and correctness

- React/TypeScript frontend and Express API share one Render origin.
- Atlas owns application records. SQLite is for local development; an explicitly selected hosted preview uses memory and clearly warns about resets.
- Participant credentials are hashed server-side. Public state returns another person's readiness/name, never their exact saved preferences.
- Deterministic checks enforce known budgets, common time windows, quiet and step-free requirements. Unknown live venue facts remain unknown.
- Changing preferences/membership invalidates candidates and votes. Confirmation is host-only, versioned and idempotent.
- Mastra runs the tool workflow. Temporal can execute durable jobs through a separate worker; its history carries IDs/version rather than private preferences.
- Voice and model inputs need explicit provider consent and review. Sentry export uses a field allowlist and omits prompts, credentials and request bodies.
- Keep API keys and database credentials in ignored local environment files and Render secret settings. Never put them in the repository or demo recording.

## Acceptance checks

- Public page and health endpoint respond successfully.
- Host and guest can join from separate sessions, save different preferences and vote without reading each other's private fields.
- Invalid dates/ranges, outsider credentials, stale votes and conflicting updates are rejected.
- Restarting the Atlas-backed app retains the outing; temporary preview always discloses that it does not.
- Known constraint conflicts produce a recoverable empty shortlist.
- Calendar download has the correct IST conversion; mobile has no horizontal overflow or runtime errors.
- Each final category claim has real evidence, and deployment/persistence limitations are stated accurately.

## Delivery

Public Render link, independent repository, sponsor evidence, deployment/check instructions, demo material and an unpublished DEV draft. Publishing the submission requires a final review of the real-recipient story and actual category evidence.

References: https://dev.to/challenges/hacktoberfest-weekend-2026-10-01 and https://render.com/docs/web-services.
