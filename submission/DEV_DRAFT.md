---
title: "SideQuest: getting the college study circle out of the chat"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

A college study group can agree to revise together and still spend the rest of the evening figuring out when everyone is free and where to sit.

SideQuest helps classmates turn that conversation into a session. A student creates a study circle and shares a link. Each student adds their study-space budget, available time, preferred kind of space and requirements privately. The group gets a shortlist, votes, and settles on one plan they can save to their calendars.

The detail I kept coming back to was the budget. Someone should be able to say "this is what I can spend" without announcing the exact number to the whole group. Other participants see readiness, options and votes. Each person's exact saved preferences stay in their own session.

I started with a hypothetical friend who ends up organising every study session. I haven't named a real recipient or collected their feedback yet, so I can't honestly claim that part of the theme is complete. The sample circle is fictional too, and the app says so. The working product helps students coordinate a study circle; that real-person story still needs to happen before I call this a finished challenge entry.

## Demo

[Open SideQuest](https://sidequest-lzrz.onrender.com)

For a quick look, choose **Explore a sample circle**. Save your preferences, find options, vote and confirm a pick. You can download a calendar invitation at the end.

To find real places to study, create a study circle and choose **Live study spaces**. SerpApi searches for libraries, campus study rooms, study cafes and coworking spaces according to the circle's preferences. Campus entry and suitability for group discussion still need checking.

Those are search results, not promises. Prices, date-specific opening hours, noise and step-free access still need checking. The cards keep those gaps visible rather than pretending every place meets every requirement.

Render hosts the app and API. MongoDB Atlas stores the plans. I confirmed a study session, redeployed the app, and read the same decision back afterwards.

## Code

{% github https://github.com/N-45div/sidequest %}

[Setup instructions and source](https://github.com/N-45div/sidequest)

## How I Built It

The interface uses React and TypeScript, with Express handling participant authorization and the shared decision. Mastra, an open-source framework, runs the discovery workflow: take the saved preferences, find candidates and return a shortlist.

The ranking rules are ordinary code that I can inspect. Known costs must fit the budgets. The activity must fit the common time window. Known conflicts with quietness or access requirements are filtered out. Unknown venue facts stay unknown. Editing preferences clears outdated options and votes, so the group cannot confirm a choice based on an earlier set of requirements.

I also ran a small open-weight model experiment with Tinker and Qwen3-8B. It used rank-8 LoRA, three training steps, 24 synthetic training cases and six held-out cases. Exact JSON matches went from 0/6 to 2/6. That was an improvement, but nowhere near enough to trust with people's preferences. The experiment remains outside the live interpretation path.

One recurring mistake was time: the model produced HHMM numbers where the app needed minutes after midnight. Keeping the same evaluation before and after tuning helped show what changed and what still failed.

Temporal has a separate local recovery test. I interrupted a worker after an injected failure; a replacement worker completed the persisted retry. Hosted Temporal is not connected yet. GitHub Actions runs the build and tests, and the public app has checks for separate participant sessions, privacy, voting, confirmation and calendar output.

The checked-in [evaluation reports](https://github.com/N-45div/sidequest/tree/main/evaluations) contain the actual results and their limits.

## Why Does Open Innovation Matter?

For this project, the useful part is being able to inspect and change the machinery behind a decision.

Mastra lets me own the workflow. Open weights let me try a small fine-tuning experiment and measure the result. The planner does not depend on a model agreeing to obey the budget or time rules: I can read those checks, change them and test them directly.

I am not claiming that a closed API could never help with this. The difference here is the control I have over the workflow and the model experiment. When the model gets something wrong, I can keep the working typed controls and improve the extraction separately.

There are still hosted services involved. Exact preferences are private from other participants, not invisible to the application's server. Any future model or voice processing requires consent and review.

## My Agent Session

Codex helped with implementation, testing, deployment and this write-up. Entire is installed locally for session capture, but no SideQuest checkpoint has been captured or published yet. I won't present a hand-written recap as a recorded session.

For now, the repository history and evaluation reports show the work. I will add an actual reviewed session link if capture is completed before publication.

## Prize Categories

The categories I can support with executed evidence are:

- **Best Use of Render:** the public frontend and API are hosted on Render.
- **Best Use of SerpApi:** actual Google Maps discovery supplies the live venue shortlist.
- **Best Use of MongoDB Atlas:** Atlas stores the app's participants, preferences and decisions; persistence was checked across redeployment.
- **Best Use of Tinker:** the real fine-tuning experiment and its limited synthetic results are recorded.
- **Best Use of Temporal:** a real local persisted retry recovered after worker replacement; no hosted deployment is claimed.
- **Best Use of GitHub Copilot, through GitHub Actions:** executed build/test automation. No Copilot coding session is claimed.

Mastra is used in the app, but its category's open-model agent scenario still needs verification. Entire is the last integration on the checklist; I will add **Best Use of Entire** once there is actual captured-session evidence. The other prepared adapters are not category claims. Arduino is outside the release scope.
