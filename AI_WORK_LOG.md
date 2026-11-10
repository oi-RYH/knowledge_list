# AI Work Log

Based on `AI_WORK_LOG_TEMPLATE.md`. This file lives only on the `web` branch and records the work on the museum site. Only work that was actually performed is listed.

## 2026-11-10 / Build the knowledge museum (3D web)

- Date (YYYY-MM-DD): 2026-11-10
- Work title: Walkable 3D museum for the knowledge records, with a quiz room

### Purpose

- Let the owner see which knowledge has been collected in `TECH_KNOWLEDGE.md` and `WORKFLOW_KNOWLEDGE.md`, and test it, as a place rather than a list.

### User Request

- Build a website from the knowledge repository that shows what has been collected and lets it be tested; interactive and creative, not a table or list.
- Museum or gallery atmosphere without literal frames; light used like Joaquín Sorolla; easy to extend as records grow.
- The test is a separate place where a sacred, non-human, higher-dimensional presence judges; simple multiple-choice quiz, no AI API.
- Agents keep generating quiz questions for new items.
- Site lives in the `knowledge_list` repository, published with GitHub Pages; `main` stays records-only and web work happens on another branch.
- After rejecting three flat mock-ups: real-time 3D, immersive, photoreal, with as little text as possible.

### Work AI Actually Performed

1. Read the repository and the owner's local (unpushed) records; counted 64 items on `main` and 99 locally.
2. Showed three flat mock-ups (rejected), researched 3D showcase techniques, then built and showed a 3D prototype (approved as the direction).
3. Created a git worktree of the repository on a new branch `web` at `~/Documents/10-19_Coding/11_Personal-Projects/11.16_knowledge-museum`. `main` and the owner's clone were not modified.
4. Wrote the data layer: a Markdown-table parser for the two record files and a join with a Korean exhibit file.
5. Wrote Korean names, one-line descriptions and one quiz question for all 99 items (`museum/data/exhibit.ko.json`).
6. Built the scene in three.js: procedural architecture generated from the record count, procedural PBR textures, sky and sea shaders, a light-probe volume for indirect light, planar floor reflection, ray-marched sunlit air, ambient occlusion, depth of field, bloom, tone curve, antialiasing, grain.
7. Simulated cloth draped over a stele offline (position-based dynamics in Node) and saved three settled shapes; the page reads them as a position texture, slides the sheet off when a stele is approached, and stirs it with wind.
8. Built the rotunda and the presence (the 3D shadow of a 600-cell rotating in four dimensions), the quiz flow, wayfinding dots, captions, synthesized sound, loading progress, a text-only fallback, and adaptive quality.
9. Verified in the in-app browser: console free of errors, WebGL error flag clear, walk, approach/unveil, quiz right and wrong answers, court, rotunda, a phone-sized viewport, and a preview with the 99 local records.
10. Wrote `PRODUCT.md`, `DESIGN.md`, `museum/README.md` and this log.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| three.js r170 (WebGL2), loaded from jsDelivr | Real-time 3D with shadows, render targets and post-processing, without a build step | whole scene |
| GLSL shaders (custom) | Sky, sea, sunlit air, textures, the presence, cloth | `museum/js/*.js` |
| Position-based dynamics cloth simulation | Physically settled drape instead of hand-shaped folds | `museum/tools/bake-veil.mjs` -> `museum/assets/veil.bin` |
| Light probes reduced to an ambient cube in 3D textures | Indirect light (bounce from the sunlit floor, sky light) that varies through the hall | `museum/js/gi.js` |
| Planar reflection | Reflection of the building in the wet floor | `museum/js/mirror.js` |
| Ray marching through the sun's shadow map | Visible shafts of light in dusty air | `museum/js/post.js` |
| GTAO, depth of field, bloom, ACES tone curve, FXAA | Camera-like image | `museum/js/post.js` |
| Web Audio API | Synthesized sea, room tone, drone and verdict sounds; opt-in | `museum/js/audio.js` |
| Google Fonts (Hahmlet) | Korean serif for inscriptions and interface | `index.html`, `museum/js/steles.js` |
| Node.js 23 | Data check and cloth bake scripts | `museum/tools/` |
| Python 3 `http.server` | Local preview with caching disabled | `museum/tools/serve.py` |
| git worktree | Work on `web` without touching the owner's `main` clone | repository |
| impeccable skill (context, surface-brief, detect) | Product/design records and a mechanical design check | `PRODUCT.md`, `DESIGN.md`, `.impeccable/` (not committed) |

### Commands Run

```text
git clone --depth 1 https://github.com/oi-RYH/knowledge_list <scratch>          # read-only look at the repository
git -C ~/Documents/90-99_Shared-Etc/AI/knowledge_list status / log / diff        # inspect only
git -C ~/Documents/90-99_Shared-Etc/AI/knowledge_list worktree add --no-track -b web <museum folder> origin/main
impeccable context
impeccable surface-brief write index.html .impeccable/brief-body.md
curl <three.js r170 shader and add-on sources on jsDelivr>                         # read to confirm APIs; nothing saved
node museum/tools/check-data.mjs
node museum/tools/check-data.mjs ~/Documents/90-99_Shared-Etc/AI/knowledge_list
node museum/tools/bake-veil.mjs                                                    # several runs while fixing the solver
VEIL_DEBUG=1 node museum/tools/bake-veil.mjs
python3 museum/tools/serve.py 4173                                                 # local preview server
impeccable detect --json index.html museum/museum.css
```

No commit and no push were made.

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| Record source | `raw.githubusercontent.com/oi-RYH/knowledge_list/main/...`, then the branch's own copies | The site follows whatever is pushed to `main`; still opens if GitHub is unreachable |
| Sun direction | `[1.0, 0.42, 0.316]` | Low late sun; the z part moves each arch's light half a bay so it lands on the left-hand steles |
| Bay length / nave half width | 5 m / 5 m | One stele per side per bay; hall length follows the record count |
| Light probes | 7 x 6 x 4 per bay, two passes, plus one probe per bay | Indirect light with a second bounce; open court and rotunda scaled separately |
| Cloth simulation | 6 cm spacing, 12 substeps, 2 solver passes in fixed order, 7 s | Stable settling; alternating the solver order was unstable and was removed |
| Quality tiers | ultra / high / medium / low, chosen by frame time | Resolution drops first, then effects |
| Sound | off until the speaker button is pressed | No audio without an explicit request |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `index.html` | Created | Page skeleton, import map, fallback container |
| `museum/museum.css` | Created | Interface styles |
| `museum/js/*.js` (18 files) | Created | Data, layout, scene, rendering, controls, quiz, sound |
| `museum/data/exhibit.ko.json` | Created | Korean names, notes and quiz questions for 99 items |
| `museum/assets/veil.bin` | Created | Three simulated cloth shapes (453 KB) |
| `museum/tools/serve.py`, `check-data.mjs`, `bake-veil.mjs` | Created | Preview server, data check, cloth bake |
| `museum/package.json` | Created | Marks the folder as ES modules for Node |
| `museum/README.md` | Created | How to open, extend and deploy (Korean) |
| `PRODUCT.md`, `DESIGN.md`, `AI_WORK_LOG.md` | Created | Product record, design record, this log |
| `.nojekyll`, `.gitignore` | Created | Serve files as-is on Pages; keep tool folders out of git |

Existing files (`AGENTS.md`, `README.md`, the two record files, the template) were not changed.

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| Static site with ES modules and no build step | Opens directly on GitHub Pages; nothing to install | No (stated to the user before building) |
| three.js from a CDN instead of vendored files | Keeps the branch small; pinned to one version | No |
| Worktree folder name and location (`11.16_knowledge-museum`) | Follows the owner's Johnny Decimal numbering; keeps the Codex-linked clone untouched | No |
| Branch name `web` | Short and descriptive | No (user asked only for "another branch") |
| Hall with steles; veil for Unreviewed; marble/limestone/basalt for the other statuses | Shows status by material instead of text | Direction approved from the prototype; details not directed |
| Two wings (concepts, then processes) with an open court between | Separates the two record files spatially | No |
| The presence as the shadow of a 600-cell | A literal non-human, higher-dimensional body | No (user asked for the feeling, not the form) |
| Everything generated in code (no image or model files) | No downloads or licences to track; consistent look | No |
| Quiz rounds of seven; results kept in `localStorage` | Gives the trial a shape without showing scores | No |
| Korean copy for all 99 items, including the 35 not yet pushed | The museum is ready when the local records are pushed | No |
| Did not edit `main` or `AGENTS.md` | User asked to keep `main` to records only for now | Yes |
| Did not commit or push | Left for the owner to decide | Default caution |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| three.js scene, camera, renderer | What each one is and how a frame is produced | Unreviewed |
| Shaders (vertex / fragment, GLSL) | What runs per vertex and per pixel; why sky, sea and cloth are shaders | Unreviewed |
| Physically based materials | Albedo, roughness, metalness, normal maps | Unreviewed |
| Shadow mapping | How the sun's shadows are made and why the shadow volume follows the visitor | Unreviewed |
| Global illumination with light probes | Why shade is not grey; what an ambient cube is | Unreviewed |
| Planar reflection | Why the scene is drawn twice for the floor | Unreviewed |
| Volumetric light by ray marching | Why shafts show only when looking across them | Unreviewed |
| Post-processing chain | Ambient occlusion, depth of field, bloom, tone mapping, FXAA | Unreviewed |
| Position-based dynamics | How the cloth was simulated, and why solver order mattered | Unreviewed |
| 4D polytope projection | What a 600-cell is and how it is projected to 3D | Unreviewed |
| Git worktree | How one repository has two folders on two branches | Unreviewed |
| GitHub Pages branch deployment and `.nojekyll` | What must be set for the site to be live | Unreviewed |
| ES modules and import maps | How the page loads code without a build step | Unreviewed |
| Web Audio synthesis | How sound is produced without audio files | Unreviewed |
| Adaptive quality / dynamic resolution | How the page keeps its frame rate | Unreviewed |

None of these were registered in `TECH_KNOWLEDGE.md` or `WORKFLOW_KNOWLEDGE.md`, because those files are on `main`, which was left untouched.

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics (Camera dolly and animation easing; Scroll-driven 3D narrative and progressive enhancement; WebGL scene preloading); Development Tools (Git repository)
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics; Environment Setup (synchronizing knowledge with Git)

## 2026-11-10 / Publish the museum and add the agent rule

- Date (YYYY-MM-DD): 2026-11-10
- Work title: Publish the site on GitHub Pages; add the Museum Entries rule to `AGENTS.md`

### Purpose

- Put the site online, and have agents write museum entries for records registered from now on.

### User Request

- Push the current state to GitHub.
- After the owner set the Pages branch to `web`: confirm that the live site works.
- Add a rule to `AGENTS.md` on `main` so that agents also write quiz entries. Of the scopes offered, the owner chose "rule only": no data file on `main`.

### Work AI Actually Performed

1. Committed the site to `web` (`8755427`) and pushed it.
2. Waited for the Pages deployment, then checked the live site at https://oi-ryh.github.io/knowledge_list/: served files identical to the commit, no console or WebGL errors, and walking, approaching a stele and answering one quiz question through real input. Removed that test answer from the browser's storage and stopped the local preview server.
3. Added the section "Museum Entries" to `AGENTS.md` in a temporary worktree of `origin/main`, committed it (`492adf3`) and pushed it to `main`. No other file on `main` changed. The owner's local clone was not touched.
4. Updated this branch's documents to describe the rule and the settled decisions.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| GitHub Pages (branch deployment) | Hosting | `web` branch, root folder |
| GitHub REST API (public, unauthenticated) | See whether Pages was enabled and whether the deployment run had finished | repository |
| Temporary detached git worktree | Commit to `main` without touching the owner's clone, which has uncommitted records and is behind `origin/main` | scratch folder, removed afterwards |

### Commands Run

```text
git add .gitignore .nojekyll AI_WORK_LOG.md DESIGN.md PRODUCT.md index.html museum
git commit; git push -u origin web
curl <Pages URL, raw files, api.github.com repo / actions runs / deployments>     # status checks only
git fetch origin
git worktree add --detach <scratch>/kl-main origin/main
git commit (AGENTS.md); git push origin HEAD:main
git worktree remove <scratch>/kl-main
pkill -f "museum/tools/serve.py 4173"                                           # stop the local preview
git commit; git push origin web                                                 # these documents
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| Pages source | branch `web`, folder `/ (root)` | Set by the owner; every push to `web` redeploys in one to two minutes |
| Where museum entries are written | `museum/data/exhibit.ko.json` on `web` | Owner's choice, to keep `main` to rules and records |
| Agents and git on `web` | No commit or push unless asked | Same as checklist changes; entries go live when the owner pushes `web` |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `AGENTS.md` (on `main`) | Changed | New section "Museum Entries", 14 lines |
| `museum/README.md`, `PRODUCT.md`, `AI_WORK_LOG.md` (on `web`) | Changed | Describe the rule, the live address and the settled decisions |
| `museum/js/config.js` (on `web`) | Changed | Comment only |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| Wording of the rule, including that agents look for a `web` worktree and create `../knowledge_list-web` on a device that has none | Needed for "rule only" to work on any device | Scope chosen by the owner; wording not directed |
| Agents do not commit or push `web` | Matches how checklist changes are handled | No |
| Committed to `main` from a temporary worktree of `origin/main` | The owner's clone has uncommitted records and is behind `origin/main` | No |
| Left the owner's local clone as it was | Same reason; agents on this machine get the rule after the owner's next sync | No |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| Detached worktree and `git push origin HEAD:main` | How a commit reached `main` without checking `main` out locally | Unreviewed |
| Pages deployment run | Why the site appeared about two minutes after the setting was saved | Unreviewed |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Development Tools (Git repository; Cross-agent shared instruction repository)
- `WORKFLOW_KNOWLEDGE.md`: Environment Setup (synchronizing shared AI knowledge across devices with Git)
