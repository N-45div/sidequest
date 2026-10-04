# SideQuest — private preferences, a real place to meet

Target: [SerpApi India Hackathon 2026](https://serpapi.github.io/serpapi-india-hackathon-2026/), **Travel & Local Discovery**.
Deadline: October 10, 2026, 23:59 IST. Draft only; no entry has been submitted.

## Project description

SideQuest helps a group choose an outing without publishing each person's exact budget, availability or requirements to the group. An organiser shares an invite; each participant saves private preferences. The app finds a shortlist, lets people vote and records one confirmed choice with a calendar download.

SerpApi Google Maps search supplies the real venues for live mode. Selected interest categories and the city form search queries; results become source-linked cards with retrieval timestamps. The deterministic planner checks the shared time window and known constraints. Unknown prices, quietness, opening hours and step-free access stay explicitly unresolved. A returned venue is a lead to check, not a guarantee that it meets every requirement.

The sample experience is separately labelled fictional. Live mode uses actual search results, not the sample catalogue. Render serves React and the Express API; MongoDB Atlas persists participant sessions and decisions. Mastra orchestrates discovery. Private exact fields stay behind participant-specific authorization; SerpApi receives city/category queries rather than budgets or participant identities.

App: https://sidequest-lzrz.onrender.com
Code: https://github.com/N-45div/sidequest

## Required disclosures

- Development began October 3, 2026, during the published September 1–October 10 event period. It also targets the DEV weekend challenge; disclose this reuse in the description and answer the form's precise existing-project question honestly.
- OpenAI Codex assisted implementation, testing, deployment and documentation. Tinker/Qwen3-8B was a separately disclosed synthetic preference-extraction experiment; it is not the live search engine or production interpreter.
- Fictional test participants and sample activity facts are labelled. No real-friend feedback or invented attendance is claimed.
- Lead details, age/residency eligibility and any team members must be provided by the participant. Do not invent community affiliation.

## Local demo recording, under three minutes

1. Run `npm ci`, `npm run build`, then `npm start`, with `SERPAPI_API_KEY` and `MONGODB_URI` configured in ignored `.env`.
2. Show localhost:3100, create a Bengaluru outing and choose **Live venues**.
3. Join from an independent participant session and save different preferences; show that exact fields remain private.
4. Find options, show returned venue names and Maps sources, and explain unresolved requirements.
5. Vote, acknowledge the venue checks, confirm and download the calendar invitation.

Never display `.env`, deployment keys, private session credentials or raw conversation history in the recording. Upload the recording to a public/unlisted link and check access in a private browser window.

## Submission readiness

Public repository and hosted core app are available. Actual public live-search checks passed and are recorded in `evaluations/serpapi-live.json`. Still needed: the local demo video, participant details and eligibility confirmation, final factual review, and the participant's acceptance of the official Rules and Terms before submitting through the website.
