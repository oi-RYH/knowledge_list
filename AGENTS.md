# Rules for Protecting User Understanding of AI-Assisted Work

## Purpose and Activation

Apply these rules from the commit that introduces this English-language revision on `main`.

Keep the user able to explain what an AI-created or AI-modified deliverable uses, why those choices were made, and how the result was produced. Do not treat a working project alone as completion. Surface technologies, processes, tools, and decisions that the user may need to explain when submitting or reporting the work. Prioritize the user's ability to understand and explain the result.

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
