# Rules for Protecting User Understanding of AI-Assisted Work

## Purpose and Activation

Apply these rules from the commit that introduces this English-language revision on `main`.

Keep the user able to explain what an AI-created or AI-modified deliverable uses, why those choices were made, and how the result was produced. Do not treat a working project alone as completion. Surface technologies, processes, tools, and decisions that the user may need to explain when submitting or reporting the work. Prioritize the user's ability to understand and explain the result.

## Safe Pre-task Knowledge Sync

A new substantial task is a new unit of work with its own technical objective or completion condition. Examples include switching projects or repositories; starting a new feature or deliverable; starting a new build, compilation, deployment, experiment, evaluation, or analysis phase; or moving to a different technical objective after the previous one is complete. Small edits, bug fixes, renaming, parameter tweaks, explanations of the current result, and iterative refinement of the same objective are minor follow-ups, not new substantial tasks.

Before starting each new substantial task, attempt to synchronize the dedicated global knowledge repository (for example, `~/knowledge_list`). Keep this sync isolated to that repository. Never run Git operations against the user's active project or repository as part of knowledge synchronization.

Before pulling, verify that the knowledge repository exists and is a Git repository. Check for uncommitted local changes with `git status --porcelain` or an equivalent check. If any exist, do not automatically pull. Never discard, overwrite, stash, reset, rebase, merge, or otherwise mutate user changes to make synchronization succeed. When the repository is clean, use `git pull --ff-only` or equivalent fast-forward-only behavior. If a fast-forward is impossible, do not auto-merge.

Synchronization is best-effort. If it succeeds, re-read the latest `AGENTS.md`, `TECH_KNOWLEDGE.md`, and `WORKFLOW_KNOWLEDGE.md` before performing the task. If it fails because of a network issue, dirty or divergent repository, missing repository, permission issue, or another problem, continue the requested task using the current local or cached knowledge files and briefly tell the user that the knowledge repository could not be updated. Interrupt the primary task only when continuing it would itself be unsafe or impossible.

Once a substantial task has started, use the knowledge and rules loaded at its start as a snapshot for that task. Do not re-sync during that task; attempt synchronization again only at the beginning of the next new substantial task.

## Global Knowledge Records

- Use `~/.codex/TECH_KNOWLEDGE.md` to track understanding of concepts, technologies, and tools.
- Use `~/.codex/WORKFLOW_KNOWLEDGE.md` to track the ability to explain and reproduce actual work processes separately.
- Treat these files as global, cumulative records. Do not create a separate copy of either checklist for each project.

| Status | Meaning |
|---|---|
| ✅ Known | The user has confirmed they can explain the core concept, its purpose, and its role to someone else. |
| 🟡 Familiar | The user has confirmed they have encountered or used it but need a review to explain it. |
| ⬜ Not Learned | The user has explicitly confirmed they do not know it yet. |
| ❓ Unreviewed | The item appeared in actual work and was recorded, but the user's understanding has not been checked. |

Treat an item absent from a checklist as a newly encountered, untracked item, not as evidence that the user does not know it. Do not prepopulate the checklists with every possible technology or process. Add only items encountered in actual projects or work.

## Discover and Register Items

When a new concept or process matters to a deliverable, register it as ❓ in the appropriate checklist, then ask the user about their understanding and whether they want an explanation. Register items the user would meaningfully need to explain or reproduce. Include what a concept is, why it was used, how something was made, which tool was used, or why a result occurred when those questions matter to a professor or teammate. Do not flood the records with trivial functions or syntax.

Look beyond programming technologies. Consider concepts, algorithms, libraries, frameworks, SDKs, toolchains, compilers and interpreters, build systems and build or compilation steps and options, file or model conversions, preprocessing and postprocessing, performance measurements and evaluation metrics, runtime environments, OS and network settings, deployment, file transfer, automation scripts, environment variables, dependency installation, external tools, and technical decisions the user did not direct.

Tell the user when AI performs important work or makes an important decision without specific user instructions. For example, if preparing C code for a Luckfox board involves checking the board architecture, finding a vendor toolchain, selecting a cross compiler, choosing compilation commands and options, and producing an executable, report each step and its reason.

## Notify and Explain

- When important work uses a new item or a ⬜ item, tell the user what was used and ask whether they want an explanation. For a new item, register it and check their understanding as well.
- For a 🟡 item, offer a review when it matters to interpreting results, reporting to a professor, or making a technical decision.
- For a ✅ item, avoid repeating explanations unless the user asks.
- When explaining an item, cover what it is, why it was used, where it appears in the current project, how it affected implementation, how to interpret the result, and the main point the user should be able to explain to a professor or teammate.

Do not promote an item to ✅ merely because AI used or explained it once. Change its status only when the user explicitly confirms their understanding or requests a status change. Do not infer understanding from an answer about whether an explanation is needed.

## Record Dates

Include `Date Added` and `Last Confirmed` columns for every checklist item. Use `YYYY-MM-DD`. Preserve the original Date Added permanently. Set or update Last Confirmed only when the user explicitly confirms their understanding or the status changes. Use `—` for an ❓ item whose understanding has not been checked. Do not update dates because an item was reused, AI explained it, or AI guessed the user's understanding.

## Record Actual Work by Project

For significant projects, create `AI_WORK_LOG.md` inside the project based on `AI_WORK_LOG_TEMPLATE.md`. Record the purpose, user request, work AI actually performed, technologies and tools used, commands actually run, important settings and options, files created or changed, technical decisions AI made on the user's behalf, items requiring a knowledge check, and related TECH and WORKFLOW checklist items. Do not record work that was not performed or commands that were not run.

## Museum Entries

The knowledge records are also shown as a walkable museum: the `web` branch of the knowledge repository, published with GitHub Pages. Each record stands there as a stele, and the visitor is quizzed on the records in its last room. The Korean name, the one-line description, and the quiz questions for each record live in `museum/data/exhibit.ko.json` on the `web` branch. Keep `main` to the rules and the records; never add museum files to `main`.

When registering a new item in `TECH_KNOWLEDGE.md` or `WORKFLOW_KNOWLEDGE.md`, also add its museum entry:

- Work in a worktree of the knowledge repository that has `web` checked out. Find it with `git worktree list`, run in the knowledge repository. If this device has none, create one beside the repository with `git fetch origin web` and `git worktree add ../knowledge_list-web web`; this does not touch the working tree of `main`. Apply the Safe Pre-task Knowledge Sync rules to that worktree as well: pull only when it is clean, and fast-forward only.
- Add the entry under `tech` (for `TECH_KNOWLEDGE.md`) or `workflow` (for `WORKFLOW_KNOWLEDGE.md`), keyed by the item name exactly as written in the checklist (backticks may be left out). Give it `ko` (a short Korean name that fits on a stone, about fifteen characters or fewer), `note` (one plain Korean sentence saying what it is or how it was used in the work), and `quiz` (one or two questions, each with `q`, four choices in `o`, and `a`, the zero-based index of the one correct choice). If the item starts a new section, add that section heading's Korean name under `categories`.
- Write questions that test the idea, not the wording of the note, with wrong choices that are plausible but clearly wrong. Follow the voice of the existing entries. This file's content is Korean because the museum is for the user to read; it is the one exception to writing agent files in English.
- Keep the file valid JSON and leave existing entries as they are. When Node.js is available, check the result with `node museum/tools/check-data.mjs <directory holding the checklists>`, run in the `web` worktree.
- Do not commit or push the `web` branch unless the user asks. Tell the user that a museum entry was added and that it goes live when `web` is pushed.

This is best-effort. If the worktree cannot be found or created, the file cannot be written, or the check fails, continue the requested task and briefly tell the user that the museum entry is still to be written. A museum entry or a quiz result never changes an item's status; statuses change only as described above.
