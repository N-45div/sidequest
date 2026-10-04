---
title: "SideQuest: private preferences, one shared outing"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*Draft using the [official submission template](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01). Public deployment is verified; real-recipient validation is still pending. This file has not been published.*

## What I Built

SideQuest turns the familiar “we should hang out” conversation into one shared plan. An organiser creates an outing, shares a link, and lets each person enter their budget, availability, interests, and requirements privately. The group sees a shortlist and votes; the organiser confirms one option and downloads a calendar invitation.

The design starts with a hypothetical friend who always organises the catch-up. No real recipient or feedback is claimed yet. The sample friends and activity prices are fictional and labelled in the app.

The part I care about most is avoiding the moment when someone has to explain their spending limit to the whole group. Their exact preference fields stay behind participant-specific authorization. Shared cards disclose uncertainty when a venue's price, access, or quietness has not been verified.

## Demo

[Try SideQuest on Render](https://sidequest-lzrz.onrender.com).

The sample experience works on the public app: create or open a group, save preferences, regenerate options, vote, confirm, and download an IST-aware calendar invitation. [Demo walkthrough](DEMO_WALKTHROUGH.md).

The public Render service uses MongoDB Atlas for durable records. Actual public API checks cover separate participants, preference isolation, voting, confirmation and calendar download. A confirmed outing was read back unchanged after a completed Render redeployment. Activities remain labelled fictional concepts; this is not a verified venue-booking service.

## Code

[SideQuest repository](https://github.com/N-45div/sidequest)

The repository is public. SideQuest is independent of Parallel: it contains no Parallel code, assets or conference-planning workflow.

## How I Built It

React and TypeScript provide the decision room. An Express API owns authorization, voting and confirmations. Deterministic checks filter known budget, time, quietness and access constraints; a model does not get to bypass them. Preference changes invalidate earlier cards and votes.

Mastra runs the discovery workflow. SerpApi Google Maps discovery is connected on Render and returns actual source-linked venues; unknown prices, hours, quietness and access are explicitly unresolved. The optional Gemma interpreter produces a validated draft for a person to review before saving. Its live model endpoint is not connected yet; typed controls already work.

Temporal runs discovery as a durable job. Workflow history carries opaque IDs and a version, while the activity loads preferences from the application's store. In the executed local test, an injected tool failure was followed by worker shutdown. A fresh worker completed the saved retry. Separate tests show that changed preferences invalidate an in-flight result.

I also ran a small real Tinker experiment with Qwen3-8B: rank-8 LoRA, three optimizer steps, 24 synthetic training cases and six held-out synthetic cases. Exact preference JSON improved from 0/6 to 2/6; correct fields improved from 24/36 to 26/36. That is useful debugging evidence, not a reliable production model. The tuned checkpoint remains outside the live interpretation path.

The baseline repeatedly represented times as HHMM rather than minutes after midnight. Tuning corrected some cases but introduced missing fields in others. Keeping the same evaluation cases before and after training made that limitation visible.

Sixteen automated tests currently pass. GitHub Actions also executed the build and test suite successfully. Desktop/mobile browser checks verify separate participant sessions, preference edits, voting, confirmation and calendar download. Voice UI checks use provider fixtures and therefore do not prove a live ElevenLabs run.

## Why Does Open Innovation Matter?

The planner's constraints and the Mastra workflow are inspectable. I can change the model endpoint independently of the shared decision flow, and I can test an open-weight model before trusting its output. Tinker let me measure a concrete fine-tuning attempt rather than assume the model improved.

This prototype does not promise offline AI or universal privacy. Hosted interpretation and voice processing require consent, and the provider still receives that input. Exact preferences are hidden from other participants, but useful shared options can still reveal broad information about the group's constraints.

## My Agent Session

Session export is pending. Earlier conversation history includes credentials, so a raw session must not be published. Git history and the checked-in tests/evaluation reports show the implemented work.

## Prize Categories

Evidence available now:

- **SerpApi:** actual public Google Maps search through the Mastra workflow, with source links and uncertainty labels.
- **Render:** actual public frontend/API deployment.
- **MongoDB Atlas:** real database write/read and deployed multi-participant checks.
- **Temporal:** real local retry/recovery execution and stale-result protection.
- **Tinker:** actual baseline/tuned results, with the tiny synthetic evaluation and weak final accuracy disclosed.
- **GitHub Copilot category, through GitHub Actions:** real build/test automation. The official category accepts Actions; no Copilot coding/review session is claimed.

Mastra runs both sample and real SerpApi discovery; its open-model interpretation endpoint still needs verification. Gemma, DigitalOcean, Tiger Data, Sentry, ElevenLabs, Backboard, TabPFN and Entire remain pending live evidence. Their adapters or setup files alone are not category claims.

Hardware is outside the active release scope; no Arduino category is entered.
