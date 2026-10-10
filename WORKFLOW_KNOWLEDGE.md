# Work Process Knowledge Checklist

This file tracks whether the user can explain or reproduce an actual work process. Track understanding of concepts themselves separately in `TECH_KNOWLEDGE.md`. Add only processes that have actually come up.

| Status | Meaning |
|---|---|
| ✅ Known | The user has confirmed they can explain the sequence of steps and reasons for choices to someone else. |
| 🟡 Familiar | The user has confirmed they have done it but need a review to explain it. |
| ⬜ Not Learned | The user has explicitly confirmed they do not know it yet. |
| ❓ Unreviewed | The process has come up, but the user's understanding has not been checked. |

An absent item does not mean Not Learned. Keep `Date Added` as the date the item was first added. Record `Last Confirmed` in `YYYY-MM-DD` only when the user confirms their understanding or the status changes; use `—` until then. The initial items below are limited to the Luckfox and C build examples discussed in conversation. Example statuses were not treated as the user's actual level.

## Build / Compilation

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Basic flow from C source to executable | ❓ | 2026-10-02 | — | Mentioned in the example of producing an executable from a C file. |
| Compiling directly with gcc | ❓ | 2026-10-02 | — | Mentioned as an example of a general C build process; actual execution not confirmed. |
| Cross compiling for another CPU architecture | ❓ | 2026-10-02 | — | Mentioned in the example of producing an executable for Luckfox. |
| Building with a vendor toolchain | ❓ | 2026-10-02 | — | Mentioned in the example of finding and using a vendor toolchain. |

## Deployment

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Deploying an executable to an embedded board | ❓ | 2026-10-02 | — | Mentioned in the example of preparing a Luckfox board deployment; actual execution not confirmed. |

## Environment Setup

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Installing the global Codex knowledge repository | ❓ | 2026-10-07 | — | Cloned `knowledge_list` and linked its instruction and checklist files into `~/.codex`. |
| Synchronizing global Codex knowledge across devices with Git | ❓ | 2026-10-07 | — | The repository is intended to be pulled before substantial tasks and committed and pushed after knowledge-record changes. |
| Cloning and maintaining a public reference repository for study | 🟡 | 2026-10-10 | 2026-10-10 | Cloned the upstream AI-Roundtable repository into a separate study folder without forking or modifying it; future upstream updates can be received with a fast-forward-only pull. The user is familiar with this workflow but may need a review to explain or reproduce it. |

## AI / Model Evaluation

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Design and evaluate a QA prompt with a representative test set | ❓ | 2026-10-07 | — | Define scope and evidence policy, create normal/edge/adversarial questions, compare prompt variants with answer-quality and grounding checks, then version the chosen prompt. |

## Networking

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Evidence-based network troubleshooting ladder | ❓ | 2026-10-07 | — | EP18: verify service, bind/port, firewall, addressing, route, NAT/cloud rules and DNS; change one factor and test again. |

## Video Production

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Produce and verify a narrated network explainer | ❓ | 2026-10-07 | — | EP18: fact-check script, map character voices, generate Korean speech, verify transcription, time captions to audio, render and inspect final media. |

## Experiment

No items recorded yet.

## Web UI and Graphics

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Screen heritage assets before implementing layer exploration | ❓ | 2026-10-09 | — | Architecture: verify official catalog format, package size, provenance and reuse terms; distinguish metadata-confirmed candidates from files whose internal member hierarchy has actually been inspected. No new model was downloaded or converted during this research. |
| Diagnose map transition coverage and verify camera framing | ❓ | 2026-10-07 | — | Architecture: identify viewport-only clipping, retain national and local map detail, preserve coordinates on full-screen promotion, then inspect transition frames and projected bounds at desktop/mobile sizes. |
| Connect a map transition to a prepared 3D viewer | ❓ | 2026-10-07 | — | Architecture: preload the actual viewer, wait for its readiness message, animate into the model, and verify return navigation without discarding GPU resources mid-transition. |
| Build an alternate entrance without replacing the existing route | ❓ | 2026-10-08 | — | Architecture: isolate a new page and presentation modules, reuse the existing precise model assets and loader, create readable fallback content, then check camera framing, interaction and responsive layout in the browser. |

## Document Preparation

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Generate and verify course-description HWPX forms from Excel and a report | ❓ | 2026-10-07 | — | Select A=1 rows, route AV=1 to new-course forms and AX=1 to rename forms, take current fields from Q–V and descriptions from the report's 교과목개요, retain blank weights/English descriptions, insert page breaks, verify XML against the sources, and inspect all rendered pages. Year 2026 comes from the supplied example because Excel has no year column. |

## Web Application Development

| Work Process | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Install and validate a Next.js MVP | ❓ | 2026-10-07 | — | Multi-AI Group Chat: pin compatible dependencies, run unit tests and lint, produce a production build, and audit runtime dependencies. |
| Verify multi-provider orchestration in demo mode | ❓ | 2026-10-07 | — | Multi-AI Group Chat: run without API keys, directly mention two agents, and confirm selection and ordered responses in the browser. |
