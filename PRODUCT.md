# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: static HTML, CSS and ES modules with no build step; three.js r170 (WebGL2) loaded from a pinned CDN URL; published with GitHub Pages from the `web` branch of `oi-RYH/knowledge_list`. Chosen because the owner asked for a site that lives in the knowledge repository and updates whenever the records are pushed.

## Users

One person: the owner of the knowledge records. They open the site alone, for their own satisfaction, to walk through what they have collected while working with AI agents and to test themselves on it. It is not a portfolio for other people.

## Product Purpose

Show which concepts and work processes are recorded in `TECH_KNOWLEDGE.md` and `WORKFLOW_KNOWLEDGE.md`, and how well each one is understood, as a place to walk through. Offer a separate room where the owner is quizzed on everything recorded so far. Success is that a visit feels like being in a museum, and that the site keeps up with the records without being redesigned.

## Positioning

The exhibits are the owner's own knowledge records, read from the repository at load time. What the visitor sees for each exhibit follows the recorded understanding status, which only the owner can change by confirming it to an agent.

## Operating Context

- The records are maintained by AI agents (Codex and others) under the rules in `AGENTS.md`. New items are registered as unreviewed; a status changes only when the owner explicitly confirms it.
- `main` holds only the rules and the records. All site work stays on the `web` branch.
- GitHub Pages is enabled on the repository.
- Local clones may hold records that have not been pushed yet; the site shows what is on GitHub.

## Capabilities and Constraints

- Four statuses: Known, Familiar, Not Learned, Unreviewed.
- Two kinds of exhibit: concepts (`TECH_KNOWLEDGE.md`) and work processes (`WORKFLOW_KNOWLEDGE.md`), grouped by the section headings in those files.
- The quiz is multiple choice with fixed answers. No AI model or API is called.
- Quiz questions, Korean names and one-line Korean descriptions are written by agents and stored in a data file. Agents are expected to keep adding them as new items are registered.
- The site never changes a status. Quiz results stay in the browser.
- Visible text is limited to concept names, one-line descriptions, and quiz questions with their choices.
- An item with no Korean entry still appears, with its English name and note, and is left out of the quiz.
- Open decision: when the exhibit data file and the agent rule for writing it move to `main`.
- Open decision: which branch GitHub Pages publishes from (it must be `web` for this site to be live).

## Brand Commitments

- The feeling of being inside a museum or gallery, carried by space, light and quiet. No picture frames or caption cards.
- Light used the way Joaquín Sorolla painted it.
- The quiz is a judgement delivered by a non-human, sacred, higher-dimensional presence.
- Real-time 3D that the visitor moves through. Flat, non-interactive renditions were rejected.
- Photoreal rendering quality.

## Evidence on Hand

- The knowledge records: 61 items on `main` as of 2026-11-10 (45 concepts, 16 processes); about 100 once the owner's local records are pushed.
- The approved 3D prototype (a walkable hall with veiled steles and a judgement room).
- No photographs, scans or third-party assets. Everything shown is generated in code.

## Product Principles

1. The records are the only source of truth; the site reads them and adds nothing to them.
2. Understanding is shown, never granted. Only the owner's confirmation in the records changes how an exhibit appears.
3. The place grows with the records. More items mean a longer hall, not a redesign.
4. Atmosphere before labels. If something can be said by light, material or motion, it is not written.
