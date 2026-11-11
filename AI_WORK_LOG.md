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

## 2026-11-11 / The well: a trial of a second composition

- Date (YYYY-MM-DD): 2026-11-11
- Work title: The well, a second composition of the museum, built as a trial page

### Purpose

- The owner found the hall well made but its composition lacking, and asked whether the site could be composed more creatively. Of three proposals they chose "the well of light". This is that composition as something to walk through, so the choice can be made by trying it.

### User Request

- "구현은 잘 확인했어. 상당히 잘 구현했네. 다만 구성이 아쉬워. 웹의 창의적인 구성 방법이 있을까?"
- "빛의 우물" (chosen for the walkable trial)

### Work AI Actually Performed

1. Built `well.html`: a round tower in the sea, hollow down the middle, with a ramp winding down the inside of its wall. The records stand along the ramp facing the shaft; the presence hovers in the shaft level with the visitor; the trial is held on the floor at the bottom. The hall (`index.html`) is unchanged.
2. Ordered the records by date added, newest at the top, with one rail dot per day. `?order=field` gives the hall's order instead.
3. Wrote the building as curved geometry generated from the record count (20 bays per turn), with arches open to the sea above the water and blind below it.
4. Wrote a light-probe layout that follows the ramp, so one gallery's light is never mixed with the next turn's.
5. Wrote the movement: scrolling walks the ramp; any stele in sight can be chosen, and a far one is flown to across the shaft through the gaps between columns.
6. Made seven shared modules slightly more general (listed below) without changing what the hall does, and checked the hall afterwards.
7. Checked in the browser: entry, looking across, mid height, below the sea, the trial, a flight, a real click on a stele across the shaft, a phone-sized portrait window, `?order=field`. Ran 2,000 random routes through a checker for the ramp, columns, rail and presence: none touched.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| Hand-built BufferGeometry in cylinder coordinates | Walls and ramp are truly round, and one bay is described once | `museum/js/well/shaft.js` |
| Ambient-cube probes indexed by ring, bearing and height above the local floor | Indirect light that respects the ramp's slabs | `museum/js/well/gi.js` |
| Centripetal Catmull-Rom curves through gate points | Flights that cannot pass through a column or the ramp | `museum/js/well/controls.js` |
| One fixed directional shadow volume | The whole well is in view at once, so the sun's shadows cover all of it | `museum/js/well/main.js` |

### Commands Run

```text
node --check <each module>
node <scratch>/well-check.mjs <repo> [records dir]      # layout numbers for 64 and 99 records
python3 museum/tools/serve.py 4173                      # local preview, left running
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| Bays per turn, fall per turn | 20, 6.4 m | 64 records make 3.2 turns (20.7 m); 99 make 5 turns (31.9 m) |
| Sun | 20 degrees high, bearing 11.25 bays | The quarter bay lands each arch's light on a stele across the shaft |
| Turns below the sea | 2 | Below it the arches are blind and the presence is the main light |
| Order | by date added, newest first | The top of the well is always "now"; `?order=field` restores sections |
| Light probes | 4 rings x 20 bearings x 2 heights per turn, two passes | 724 of 960 captured for 64 records; `?gi=1` does one pass |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `well.html` | Created | Page for the trial |
| `museum/js/well/main.js`, `layout.js`, `shaft.js`, `gi.js`, `controls.js` | Created | The well |
| `museum/js/materials.js` | Changed | `useGI` accepts another probe lookup |
| `museum/js/gi.js` | Changed | Exports the integration shader, the volume texture helper and `captureEnvironment` |
| `museum/js/post.js` | Changed | The air can fill a round building |
| `museum/js/skysea.js` | Changed | The sea can lie all round a circular wall, at a given level |
| `museum/js/steles.js` | Changed | A slot may carry a height |
| `museum/js/being.js` | Changed | The presence can be moved and its brightness scaled |
| `museum/js/controls.js` | Changed | Wheel gain is a property |
| `museum/README.md`, `PRODUCT.md`, `AI_WORK_LOG.md` | Changed | Describe the trial |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| Reused the real materials, steles and presence instead of a grey-box model | Flat or unfinished renditions were rejected before; a composition is hard to judge without its light | No (a structure-only model had been proposed) |
| Date order, newest at the top | The proposal said the top is always "now" | Composition chosen by the owner; this ordering not directed |
| The presence follows the visitor down instead of waiting at the bottom | The proposal said it is present throughout | No |
| Steles before the piers, columns under the arches | The presence's light and the sun from across both reach every stele | No |
| Any visible stele can be chosen and flown to | Seeing everything at once only matters if it can be reached | No |
| A separate `well/main.js` that repeats parts of `main.js` | Keeps the hall untouched until a composition is chosen | No |
| Not committed or pushed at the time | The owner had not asked; it was published later, together with the adoption | No |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| Light probes on a helix | Why the probe height is measured from the sloping floor rather than from the ground | Unreviewed |
| Catmull-Rom route through gates | Why the flight goes through fixed points instead of bending one curve | Unreviewed |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

## 2026-11-11 / The well adopted as the site

- Date (YYYY-MM-DD): 2026-11-11
- Work title: The well replaces the hall as the site

### Purpose

- The owner adopted the well. Make it the site itself instead of a trial page beside the hall, and leave one building and one set of modules to maintain.

### User Request

- "우물로 채택" (in answer to whether the well should become the main composition)
- "올려줘" (in answer to whether to publish the well at the live address)

### Work AI Actually Performed

1. Made `index.html` load the well and removed `well.html`. The page is now titled "빛의 우물".
2. Moved the trial's modules out of `museum/js/well/` to `museum/js/` (`main.js`, `layout.js`, `shaft.js`) and removed the hall's building (`hall.js`, `sanctum.js`, its `main.js` and `layout.js`). The hall remains in the branch history up to commit `cbffe19`.
3. Folded what the trial had added beside the shared modules back into them: one `Walk` class in `controls.js`, one `GI` class in `gi.js`, the well's dimensions in `config.js` as `DIM`, the round sea in `skysea.js`, the round air volume in `post.js`. `materials.js` returned to its earlier form.
4. Reduced the floor hooks in `mirror.js` to the reflection; the puddles and the basin belonged to the hall's floor.
5. Two adjustments found while checking: a right answer no longer whites out the pale walls (the presence's body and its light now have separate gains, and the swing of a verdict is smaller), and a stele more than four bays away is flown to instead of walked round to.
6. Checked again in the browser after the move: entry, across the shaft, below the sea, the trial with a right answer, a real click on a stele across the shaft and Escape, a phone-sized portrait window, `?order=field`, `?plain`. Ran 3,000 random routes through the same checker as before: none touched the ramp, a column, the rail or the presence.
7. Rewrote `museum/README.md` and `DESIGN.md` for the well and updated `PRODUCT.md`.
8. On the owner's request, committed the adoption to `web` and pushed it, so GitHub Pages serves the well instead of the hall.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| No new technology | The work was moving and merging what the trial had built | |

### Commands Run

```text
cp -R museum index.html well.html AI_WORK_LOG.md PRODUCT.md DESIGN.md <scratch>/before-adoption/   # safety copy, outside the repository
git checkout -- museum/js/materials.js
rm -rf museum/js/well museum/js/hall.js museum/js/sanctum.js well.html
node --check <each module>
python3 museum/tools/serve.py 4173                      # already running; used for the checks
node museum/tools/check-data.mjs
git add -A && git commit                               # on web, after the owner asked
git push origin web
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| Walk-round range | 4.2 bays | Nearer steles on the same stretch of ramp are walked to; farther ones are flown to across the shaft |
| Verdict swing of the presence's light | x1.75 at most for a right answer (was x2.6) | The walls are pale here; the stronger burst whited them out |
| `QUALITY.*.shadow` | one number (4096, low 2048) | The sun's shadow map is square now that it covers the whole well |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `index.html` | Changed | Title and plain heading "빛의 우물" |
| `well.html`, `museum/js/well/` | Removed | The trial became the site |
| `museum/js/hall.js`, `museum/js/sanctum.js` | Removed | The hall's nave and rotunda |
| `museum/js/main.js`, `layout.js` | Replaced | Now the well's entry point and layout |
| `museum/js/shaft.js` | Created | The well's fabric (moved from the trial) |
| `museum/js/controls.js`, `gi.js` | Rewritten | One class each, for the well |
| `museum/js/config.js`, `post.js`, `skysea.js`, `mirror.js`, `being.js`, `steles.js` | Changed | The hall's options removed; the well's are the defaults |
| `museum/js/audio.js`, `quiz.js`, `museum/museum.css` | Changed | Comments, and the trial mark's class |
| `museum/README.md`, `DESIGN.md`, `PRODUCT.md`, `AI_WORK_LOG.md` | Changed | Describe the well as the site |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| Removed the hall instead of keeping it as a second page | Adopting one composition leaves one to maintain; the hall is recoverable from history | Adoption directed; removal not |
| Renamed the page to "빛의 우물" | The name the owner chose the composition by | No |
| Kept date order as the default | It is the order the adopted trial had | No |
| Softened the verdict's burst of light and shortened the walk-round range | Both looked wrong in the check after the move | No |
| Committed and pushed to `web` only after the owner asked | Publishing is the owner's call | Yes ("올려줘") |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| Removing code that history keeps | How the hall can be brought back from commit `cbffe19` if wanted | Unreviewed |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics; Development Tools (Git repository)
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

## 2026-11-11 / Paint: a trial of a painted picture

- Date (YYYY-MM-DD): 2026-11-11
- Work title: The picture laid down in brush strokes, as a trial beside the photographic one

### Purpose

- The owner asked whether the photographic rendering could be given the texture of applied paint, like an actual Sorolla. Build that as a mode that can be switched on and compared, without changing what is published.

### User Request

- "지금은 실사 렌더링이잖아? 이제 실제 소로아의 그림처럼 물감을 칠한 질감이 나도록 할 수 있어?"

### Work AI Actually Performed

1. Wrote `museum/js/paint.js`: a pass after the grade that lays the finished picture down again in strokes, and a second pass that treats the result as a painted canvas (relief of the paint under raking light, weave, sharp last touches).
2. Laid the strokes out on the surfaces themselves, in the well's coordinates (bearing, height, radius), rebuilt per pixel from the depth buffer, so they stay put as the visitor walks. Each surface carries strokes in every size; the four that come out between a small and a broad brush on the screen are used. Sea and sky are laid out by direction.
3. Gave every stroke one colour (the picture's at its middle, read from the mip level as coarse as the stroke is wide) and stopped it where the picture stops resembling that colour. Smaller strokes appear only where they differ from what a broad one would lay in.
4. Added a painter's palette for white things (warm in sun, sky-coloured in shadow, faded out below the sea), left the presence unpainted where its light shows, and drew a stepped-up-to stone's lettering back in so the name can be read.
5. Wired it into `post.js` (`Pipeline.setPaint`), `config.js` (`QUALITY.*.paint`) and `main.js` (`?paint`, the P key).
6. Checked in the browser: entry, across the shaft, a stone with its sheet on and one stepped up to, below the sea, the floor with a question up, a phone-sized portrait window. Measured against the photographic picture at the same places: mean brightness within about 1% above the sea and 3% below it; frame-to-frame change standing still the same; walking 1.2 to 2.3 times as much and looking round 1.0 to 1.45 times as much (the stroke texture moves with the surfaces); frame time about 10.5 ms against 15.3 ms at 1935 x 1474 on this Mac.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| Stroke-based painterly rendering as a screen pass (gathered strokes, after Hertzmann's layered brush sizes) | Real strokes with direction, overlap and bristle marks, not a blur filter | `paint.js`, `STROKES` |
| World-anchored stroke layout with a size chosen by distance (as in dynamic solid textures) | Strokes fixed to the screen slide over the scene when the camera moves | `paint.js`, the layout in `main()` |
| Mip chain of the finished picture | A stroke's colour is the picture averaged over the stroke's width, in one fetch | `PaintPass.source` |
| Height field of the paint and a raking light | Impasto and bristle grooves | `paint.js`, `FINISH` |

### Commands Run

```text
node --check museum/js/*.js
node museum/tools/check-data.mjs
python3 museum/tools/serve.py 4173        # already running; http://localhost:4173/?paint
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| `PaintPass.stroke` | 0.0075 of the picture's height | Short side of the smallest stroke's cell; the broadest are eight times that |
| `QUALITY.*.paint` | 0.7 (ultra 0.75, low 1.0) | The strokes are laid at this fraction of the picture's size; the finish is at full size |
| `uLike` / `uSay` | 0.055..0.15 / 0.045..0.13 | How unlike the picture a stroke may be before it gives way; how much a smaller stroke must add to be there |
| `PaintPass.relief`, `canvas` | 0.36, 0.05 | Strength of the raking light and of the weave; both ease off on small or coarse pictures |
| `?paint`, key P | off by default | The published site is unchanged until the owner adopts the look |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `museum/js/paint.js` | Created | The paint pass |
| `museum/js/post.js` | Changed | Adds the pass after the grade; `setPaint` switches it with the lens effects it replaces |
| `museum/js/config.js` | Changed | `paint` in each quality tier |
| `museum/js/main.js` | Changed | `?paint`, the P key, the per-frame inputs (presence, depth of the visitor, reading a stone) |
| `museum/README.md`, `DESIGN.md`, `AI_WORK_LOG.md` | Changed | Describe the trial |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| A switchable trial, off by default | The photographic picture was what the owner had approved and published an hour earlier | No |
| Strokes anchored to surfaces instead of to the screen | The site is walked through; screen-anchored strokes would crawl | No |
| The presence left unpainted | Painted, its lattice became a white ball and lost what makes it a presence | No |
| Sky-coloured shadows on white | Texture alone left the picture beige; this is the colour Sorolla's whites have | No |
| Lettering drawn back in before a focused stone | Faint inscriptions were lost in the brushwork, and the names are the content | No |
| Not committed or pushed at the time | The owner had asked to publish the well, not this; it was published later, with its adoption | No |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| World-anchored strokes | Why strokes fixed to the screen slide over a moving scene, and how laying them out on surfaces avoids it | Unreviewed |
| Mip chain as a blur | Why reading a coarser mip level gives the average colour under a stroke | Unreviewed |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

## 2026-11-11 / Paint adopted as the picture

- Date (YYYY-MM-DD): 2026-11-11
- Work title: The painted picture becomes the default

### Purpose

- The owner looked at the trial and adopted it. Make the painted picture what the site shows, and keep the camera's picture reachable.

### User Request

- "채택" (in answer to whether the painted texture should become the default picture)
- "올려줘" (in answer to whether to publish the painted picture at the live address)

### Work AI Actually Performed

1. Made the paint the default in `main.js`: `?paint=0` now shows the camera's picture, and P still switches while looking.
2. Drew one frame before the place is shown, so the paint shader (and every other) is compiled behind the loading line instead of in the visitor's first second.
3. Rewrote the parts of `museum/README.md`, `DESIGN.md` and `PRODUCT.md` that called the paint a trial. `PRODUCT.md` no longer lists photoreal rendering as a commitment; it records that the owner asked for it first and for paint afterwards.
4. Checked again in the browser: the plain address opens painted, `?paint=0` opens photographic, P switches both ways, a phone-sized portrait window opens painted.
5. On the owner's request, committed the paint and its adoption to `web` and pushed it, so GitHub Pages serves the painted picture.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| No new technology | The work was a default and the documents | |

### Commands Run

```text
node --check museum/js/*.js
node museum/tools/check-data.mjs
git add -A && git commit                               # on web, after the owner asked
git push origin web
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| `?paint=0` | off by default | Shows the picture as the camera made it, with its depth of field, edge smoothing and grain |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `museum/js/main.js` | Changed | Paint on unless `?paint=0`; one frame drawn before the place is shown |
| `museum/js/post.js` | Changed | The pipeline starts painted |
| `museum/README.md`, `DESIGN.md`, `PRODUCT.md`, `AI_WORK_LOG.md` | Changed | Describe the paint as the picture |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| Kept the camera's picture behind `?paint=0` and the P key | It costs nothing, and it is what the paint is laid over | No |
| Drew a frame before showing the place | A large shader compiling in the first visible second would stutter the opening | No |
| Committed and pushed to `web` only after the owner asked | Publishing is the owner's call | Yes ("올려줘") |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| Shader compilation on first use | Why the first frame that uses a shader is slow, and why drawing one frame early hides it | Unreviewed |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

## 2026-11-11 / Looking round freely

- Date (YYYY-MM-DD): 2026-11-11
- Work title: The head is freed: drag to look all the way round

### Purpose

- The owner found that the view could not be turned freely and asked whether that was intended. It was (the gaze followed the mouse within about 50 degrees to either side and 30 up and down). The owner asked for it to be changed.

### User Request

- "지금 화면 전환이 자유롭지 않은데, 의도된거야?"
- "바꿔줘" (in answer to whether dragging should look round freely in every direction)
- "올려줘" (in answer to whether to publish it at the live address)

### Work AI Actually Performed

1. Replaced the gaze that followed the mouse's position with one the visitor drags: the scene is taken hold of and pulled, by exactly the angle the pointer moves through, all the way round and up to 81 degrees up or down.
2. Let a drag that is released while moving carry on and come to rest, stopped at once by taking hold again; a pull past the limit gives a little and springs back.
3. Kept the feet on the rail. Walking, flying to a stele and the dots are unchanged.
4. Touch: one finger either walks (up or down) or turns (sideways), whichever way it sets off, and the turn now stays where it is left; two fingers turn the head every way.
5. Keys: left and right arrows (and A, D) turn the head 30 degrees.
6. Stepping up to a stele still faces it squarely, and the head can turn from there. Arriving on the floor of the well draws the gaze to the presence once.
7. Checked in the browser with real and synthesised pointer input: a drag turns by exactly the angle under the pointer; a drag held still before release stays put; one released while moving glides and rests; a glide is caught by pressing again; a pull past the limit returns to it; a click and a tap are still a click and a tap; the keys, one-finger and two-finger touch, turning while before a stele and stepping back, and the gaze on arrival all behave as described.
8. On the owner's request, committed the change to `web` and pushed it.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| Pointer Events with pointer capture | One code path for mouse and touch, and a drag that continues outside the picture | `controls.js`, `_listen` |
| Momentum with exponential decay; resistance past a limit | A gesture follows the hand while held and physics after release | `controls.js`, `update` |

### Commands Run

```text
node --check museum/js/controls.js
python3 museum/tools/serve.py 4173        # already running
git add -A && git commit                  # on web, after the owner asked
git push origin web
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| `PITCH` | 1.42 rad (81 degrees) | How far up or down the head tilts; straight up would let the view flip |
| `SLACK`, `GIVE` | 0.6 rad, 0.18 | How far a drag may pull past the limit and how much of that shows |
| Glide after release | decays at 6.5 per second, at most 4 rad/s | A slow release adds a few degrees; the hardest fling about 35 |
| Touch gain | 1.5 | A thumb has less room than a mouse |
| `STEP` | 30 degrees | One press of an arrow key |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `museum/js/controls.js` | Changed | Drag to look, momentum, limits, keys, touch |
| `museum/museum.css` | Changed | The picture shows a grab cursor and cannot be text-selected |
| `museum/README.md`, `DESIGN.md`, `AI_WORK_LOG.md` | Changed | Describe looking round |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| Dragging pulls the scene (drag right, see what is to the left) | It is how street-level and panorama viewers work, and it keeps what was under the pointer under it | No |
| The gaze no longer follows the mouse when nothing is pressed | Two ways of turning at once made aiming at a far stele harder | No |
| The feet stay on the rail | Walking anywhere needs collisions with wall, columns and stones; the owner was offered that separately | Yes (the offer said the path stays) |
| The gaze is drawn to the presence once on arrival | The question should not appear behind the visitor's back | No |
| Committed and pushed to `web` only after the owner asked | Publishing is the owner's call | Yes ("올려줘") |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| Tracking and release in a gesture | Why the view must follow the pointer exactly while held, and why momentum belongs only after release | Unreviewed |
| Pointer capture | What `setPointerCapture` does and why a drag needs it | Unreviewed |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

## 2026-11-11 / Paint: distinct things, colour, reflected light

- Date (YYYY-MM-DD): 2026-11-11
- Work title: The painted picture made clear and coloured, against three Sorolla paintings the owner supplied

### Purpose

- The owner compared the page with three Sorollas (children running on the beach, two women walking by the sea, a seated portrait) and found it wanting: in the paintings things are clearly set apart, colour is varied, and light and reflected light are used well, while the page looked like plain impressionism, with soft, unclear edges.

### User Request

- "아쉬운 점은, 소로아의 그림들을 보면 오브젝트들 간에 구분이 명확하고 색감이 다양하면서 반사광과 빛을 잘 써. 근데 우리의 페이지는 단순 인상파와 같이 경계가 흐릿하고, 명확하지 않아." (with three reference paintings)

### Work AI Actually Performed

1. Measured the picture as it was: the sky was nearly grey (199, 199, 205), every shadow on white was beige (about 208, 196, 175), and the sea was pale. Texture alone could not give colour that was not there.
2. Added a pass before the strokes, the painter's eye, that gives each part of the picture the colour he would have mixed. Where the sun falls is read from the sun's shadow map; which way a surface faces from the depth buffer. Sunlit white stays warm; shadow takes the sky's blue-violet on planes that face up or stand, and the floor's warm glow on planes that face down or stand just above the floor. The sea and sky are given their blues. The ramp is warmed and the wall deepened a little so materials part.
3. Made every stroke belong to one thing: a stroke whose middle is hidden behind another thing, or lies past this thing's edge, is not laid there, and the ground under the strokes is the picture itself, so nothing shows through an edge but the thing's own colour. The strokes are then brought up to the screen's size from the right side of each edge.
4. Removed the smallest strokes (folds were being stippled), narrowed the range over which a stroke gives way, and lowered the relief, which was reading as blur.
5. Laid sea and sky out without the seams their cube faces had, which showed as a false corner in the sky once the head could turn up.
6. Checked in the browser: the entry, across the shaft, a sheet in sun at close range, the sun-side wall seen against the light, a stone stepped up to, below the sea, the floor of the well, a phone-sized portrait window. Measured: standing still the picture changes no more than the camera's; walking about 2.2 times as much and looking round 1.4 times; frame time about 10.8 ms against 15.5 ms at 1935 x 1474 on this Mac.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| The sun's shadow map, read in a screen pass | Sun and shade decided exactly, not guessed from brightness | `paint.js`, `EYE` |
| Normals rebuilt from depth | Which way a surface faces decides which reflected light it takes | `paint.js`, `EYE` |
| Depth test at each stroke's middle; depth-aware upsampling | Strokes kept to one thing; outlines at full resolution | `paint.js`, `STROKES` and `FINISH` |
| Mercator layout by direction | Sea and sky strokes with one continuous layout and no pole or seam in view | `paint.js`, `STROKES` |

### Commands Run

```text
node --check museum/js/*.js
python3 museum/tools/serve.py 4173        # already running
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| Shadow fill, cool / warm | (0.90, 0.985, 1.30) / (1.19, 0.955, 0.70), at equal brightness | The sky's colour and the floor's glow that shadow takes |
| `uLike` | 0.07..0.13 | A stroke gives way over a narrower range: cleaner cuts |
| `uSay` | 0.07..0.17 | Smaller strokes only at real edges |
| `PaintPass.relief` | 0.26 | Lower: the relief was softening the picture |
| `QUALITY.high.paint` | 0.66 | Keeps the frame inside 16.7 ms with the extra pass |
| `PaintPass.palette` | 1 above the sea, 0.3 at the bottom | The painter's eye stands back where the presence's colour is its speech |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `museum/js/paint.js` | Changed | The painter's eye pass; strokes kept to one thing; clean outlines; sea and sky laid out without seams |
| `museum/js/post.js`, `museum/js/main.js` | Changed | Hand the pass the sun and the shape of the ramp |
| `museum/js/config.js` | Changed | Stroke resolution at `high` and `medium` |
| `museum/README.md`, `DESIGN.md`, `AI_WORK_LOG.md` | Changed | Describe the three steps |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| Colour changed in the paint, not in the scene | The camera's picture (`?paint=0`) and its light stay as computed; the paint leans further the way a painter would | No |
| The ramp warmed and the wall deepened slightly | White on white cannot be set apart by outline alone | No |
| The palette stands back below the sea | There the presence's colour carries the verdict | No |
| Not committed or pushed at the time | The owner had not asked; published later, with the far-sea fix | No |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| Shadow map lookup in a screen pass | How a pixel's world position is tested against the sun's depth map | Unreviewed |
| Depth-aware (bilateral) upsampling | Why a low-resolution layer is taken only from neighbours at a similar depth | Unreviewed |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

## 2026-11-11 / Paint: the sea left as it is

- Date (YYYY-MM-DD): 2026-11-11
- Work title: No brush strokes over the sea; reflected light taken from the picture

### Purpose

- The owner saw, at the horizon, the sky's rough strokes laid over the sea's own rendering, and asked for the sea to be left as the sea.

### User Request

- "지금 수평선을 보면, 기존의 바다 표현 위에 하늘의 러프한 터치가 덧씌워졌어. 바다는 바다 표현 그대로 해줄래?"

### Work AI Actually Performed

1. Left the sea unstroked: in the finish it is shown as the picture has it (its waves and glitter), in the painter's colours, with no relief or weave over it. Sky strokes may no longer cross the horizon or take their colour from anything but sky.
2. While checking, found shadows on the floor painted warm and a shaded corner muddy. The warm reflected light is now given only to planes that face the floor (wherever the picture shows warmth) and to upright planes where the picture is clearly warm; planes that face the sky always take the sky's colour.
3. Checked the horizon through an arch, the entry, a shaded corner by a sill, and across the shaft, with the full light bake.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| No new technology | A mask from depth and radius, and a rule on the existing palette | `paint.js` |

### Commands Run

```text
node --check museum/js/paint.js
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| Warmth that counts as reflected light | above 0.10..0.20 on planes facing the floor, 0.17..0.30 on upright ones, never on planes facing the sky | (red minus blue) over brightness, read from the camera's picture |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `museum/js/paint.js` | Changed | The sea is not stroked; sky strokes stay above the horizon; reflected light read from the picture |
| `museum/README.md`, `DESIGN.md`, `AI_WORK_LOG.md` | Changed | Describe both |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| The sea keeps the painter's colours | The owner objected to the strokes over it, not to its colour | No |
| Reflected light read from the picture instead of assumed near every floor | Assumed warmth muddied corners where no sunlit floor was near | No |
| Not committed or pushed at the time | The owner had not asked; published later, with the far-sea fix | No |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| None new | | |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

## 2026-11-11 / The far sea stops flickering

- Date (YYYY-MM-DD): 2026-11-11
- Work title: Waves smaller than a pixel are no longer drawn or amplified

### Purpose

- The owner saw the dark blue part of the sea near the horizon crackling from frame to frame.

### User Request

- "근데 수평선 근처의 짙은 남색 부분이 너무 지직거려."
- "올려줘" (in answer to whether to publish the picture as it now is)

### Work AI Actually Performed

1. Measured it standing still: in the band just under the horizon the painted picture changed 0.26 levels a frame against the camera's 0.09, and 0.51 against 0.17 a little lower.
2. Found two causes. The sea's shader drew ripples and short swells at every distance, so far out they were smaller than a pixel and only noise; and the painter's eye, in giving the sea its deep colour, multiplied that noise about two and a half times.
3. In `skysea.js`, a swell or ripple shorter than a couple of pixels is now left out (by how much water a pixel covers). In `paint.js`, the sea is read as the average of a few pixels, and beyond a few hundred metres is laid in calm, with a few long level streaks.
4. Measured again in the same bands: 0.01 just under the horizon and 0.12 lower down (the camera's own picture: 0.06 and 0.07). Nearer the tower, where the waves really move, it is 0.42 against 0.28.
5. On the owner's request, committed this and the two changes before it (distinct things, colour and reflected light; the sea left unstroked) to `web` and pushed them.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| Band-limiting by pixel footprint (`fwidth`) | Detail finer than a pixel cannot be drawn steadily; leaving it out is the cure, not blurring afterwards | `skysea.js`, the sea's fragment shader |

### Commands Run

```text
node --check museum/js/skysea.js museum/js/paint.js
git add -A && git commit                  # on web, after the owner asked
git push origin web
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| A swell is left out when | the water under one pixel times the swell's frequency passes 1 .. 2.6 | Roughly when its wavelength falls under two or three pixels |
| The sea is laid in calm | from 50 m, fully by 380 m | Beyond that its waves are below a pixel from the ramp's height |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `museum/js/skysea.js` | Changed | Waves smaller than a pixel are not drawn |
| `museum/js/paint.js` | Changed | The far sea is averaged and laid in calm |
| `museum/README.md`, `DESIGN.md`, `AI_WORK_LOG.md` | Changed | Describe it |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| Fixed in the sea's own shader as well as in the paint | The noise was in the camera's picture first; the paint only made it show | No |
| Committed and pushed to `web` only after the owner asked | Publishing is the owner's call | Yes ("올려줘") |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| Aliasing of procedural detail | Why detail smaller than a pixel flickers, and why it has to be removed before it is drawn | Unreviewed |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

## 2026-11-11 / Sea and sky painted alike

- Date (YYYY-MM-DD): 2026-11-11
- Work title: One handling for sea and sky: a finer brush for both

### Purpose

- After the last two changes the sea was the shader's smooth picture and the sky was broad, thick strokes. The owner found the sea too smooth to be paint, the sky's brush too thick to look good, and the two too unlike to sit in one picture.

### User Request

- "바다는 이제 너무 부드러워서 그림 느낌이 없고, 하늘은 붓이 너무 두꺼워서 퀄리티가 낮아보여. 그리고 이 둘이 너무 차이가 나서 이질감이 강하게 들어." (with a screenshot of the horizon through an arch)
- "더 다듬기" (after seeing the result)
- "올려줘" (in answer to whether to publish the picture as it now is)

### Work AI Actually Performed

1. Painted the sea again, but in its own strokes: small level ones, each a slightly different blue between turquoise and violet, now and then a lighter one. Its waves are no longer put back sharply over the strokes (that was the photograph showing through the paint the owner first objected to); only its glitter is.
2. Gave the sky a brush about two and a half times finer than before, laid thinly, with strokes that melt into one another and vary a little in blue.
3. Kept both on one scheme (the same layout by direction, the sea's brush a little smaller than the sky's), and kept the sky's strokes above the horizon.
4. Stopped the wall's colour leaking into the sea's edge: a stroke of sea whose middle lies on the wall is not laid, and sea and sky are read narrowly enough not to take in what stands beside them.
5. Measured the flicker again, standing still: sky 0.01, just under the horizon 0.01, lower 0.07, near the tower 0.19 (the camera's own picture: 0.06, 0.07 and 0.28 for the three bands of sea). Frame time unchanged, about 15.5 ms against 10.8 ms.
6. Asked to refine further, looked at the arch again: the sea read as a mosaic, every stroke its own colour, and the sky as fine scales. The colour of both now runs in long level bands, with only a little of each stroke's own; the sea's strokes are slender and level; the sky's paint is thinner and its strokes melt further. Flicker after this: sky 0.02, under the horizon 0.01, lower 0.09, near the tower 0.16.
7. On the owner's request, committed this to `web` and pushed it.

### Technologies / Tools Used

| Technology or Tool | Reason for Use | Where Applied |
|---|---|---|
| No new technology | Settings of the stroke pass chosen per kind of surface (a thing, the sea, the sky) | `paint.js`, `STROKES` and `FINISH` |

### Commands Run

```text
node --check museum/js/paint.js
```

### Important Settings / Options

| Setting or Option | Value | Reason and Effect |
|---|---|---|
| Brush for sky / sea | 0.7 / 1.0 doublings finer than the scheme's | Was 0.6 broader: the sky's strokes are about 2.5 times smaller |
| Paint thickness, sky / sea | 0.4 / 0.62 of a wall's | Thin paint: no thick ridges in the sky |
| Edge softness, sky / sea | 0.09 / 0.03 of a cell more than on a thing | The sky's strokes melt; the sea's stay distinct |
| Variation of one stroke, sea | value by up to 8%, hue between turquoise and violet | "Many blues at once"; the sky gets 38% of it |

### Files Created or Changed

| File Path | Created or Changed | Description |
|---|---|---|
| `museum/js/paint.js` | Changed | Sea and sky handled alike; sea stroked again; edge leaks closed |
| `museum/README.md`, `DESIGN.md`, `AI_WORK_LOG.md` | Changed | Describe it |

### Technical Decisions AI Made on the User's Behalf

| Decision | Rationale | Directed by User? |
|---|---|---|
| The sea is stroked again, after the owner had asked for it to be left as it was | The owner's objection then was to rough strokes over a sharp sea; left alone it had no paint in it. Strokes of its own, with nothing sharp showing through, answer both | Partly: the owner asked for a painted feel; the means are AI's |
| Committed and pushed to `web` only after the owner asked | Publishing is the owner's call | Yes ("올려줘") |

### Items Requiring a User Knowledge Check

| Item | Question or Explanation Needed | Check Result |
|---|---|---|
| None new | | |

### Related Checklist Items

- `TECH_KNOWLEDGE.md`: Web Graphics
- `WORKFLOW_KNOWLEDGE.md`: Web UI and Graphics

