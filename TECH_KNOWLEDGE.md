# Technology and Concept Knowledge Checklist

This file tracks whether the user understands a concept itself. Track the ability to explain a work process separately in `WORKFLOW_KNOWLEDGE.md`. Add only items that have actually come up.

| Status | Meaning |
|---|---|
| ✅ Known | The user has confirmed they can explain the core concept, purpose, and role to someone else. |
| 🟡 Familiar | The user has confirmed they have used it but need a review to explain it. |
| ⬜ Not Learned | The user has explicitly confirmed they do not know it yet. |
| ❓ Unreviewed | The item has come up, but the user's understanding has not been checked. |

An absent item does not mean Not Learned. Keep `Date Added` as the date the item was first added. Record `Last Confirmed` in `YYYY-MM-DD` only when the user confirms their understanding or the status changes; use `—` until then. The initial items below are limited to the Luckfox and C build examples discussed in conversation. Example statements about knowledge levels were not treated as the user's actual level.

## Programming Languages

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| C | ❓ | 2026-10-02 | — | Mentioned in the example of preparing C code for Luckfox; understanding not checked. |

## Build / Compilation

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Compiler | ❓ | 2026-10-02 | — | Needed to explain the relationship between C source code and an executable. |
| Toolchain | ❓ | 2026-10-02 | — | Mentioned in the example of finding build tools for Luckfox. |
| Cross Compilation | ❓ | 2026-10-02 | — | Mentioned in the example of producing an executable for another CPU. |

## Embedded Systems

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| ARM Architecture | ❓ | 2026-10-02 | — | Mentioned in the example of checking the target CPU architecture for Luckfox. |

## Networking

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Network troubleshooting evidence and error semantics | ❓ | 2026-10-07 | — | EP18: refused, timeout, unreachable, DNS errors and HTTP status codes are diagnostic clues, not definitive proof of a failing component. |

## Video Production

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Remotion and React frame-based video rendering | ❓ | 2026-10-07 | — | EP18: reusable character sprites, diagrams and captions rendered on a 30 fps timeline. |
| ElevenLabs TTS and independent speech recognition | ❓ | 2026-10-07 | — | EP18: Roger/Sarah/Laura Korean speech generated per caption, then transcribed to detect language and pronunciation problems. |
| FFmpeg audio normalization and video encoding | ❓ | 2026-10-07 | — | EP18: normalize speech loudness, synchronize clips and encode H.264/AAC MP4. |

## Computer Vision / AI

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| YOLOv5n / YOLOv8n | ❓ | 2026-10-09 | — | Hwashin: two small detection models trained on the Hwashin video only, at the professor's request. |
| Pretrained weights (transfer learning) | ❓ | 2026-10-09 | — | Hwashin: training starts from COCO-pretrained yolov5n.pt / yolov8n.pt; whether this counts as "another dataset" is pending. |
| YOLO detection head (stride, anchor) | ❓ | 2026-10-29 | — | Hwashin L1/L2: YOLOv5n has 3 outputs (stride 8/16/32, P3-P5) with 3 anchors each; people are ~32x39 px at 416x224 input, so P5 may be unused. |
| Width multiplier (channel scaling) | ❓ | 2026-10-29 | — | Hwashin L3: shrinking YOLOv5n width 0.25 to 0.18 / 0.125 to make the model lighter. |
| Knowledge distillation | ❓ | 2026-10-29 | — | Hwashin L5: train a small model to imitate a larger teacher to recover accuracy. |
| Pruning (structured) | ❓ | 2026-10-29 | — | Hwashin L6: remove low-importance channels and retrain. |
| INT8 quantization (RKNN) | ❓ | 2026-10-30 | — | Hwashin Q: FP32 model converted to 8-bit integers for the RV1106 NPU; loss appears only on models not trained on Hwashin. |
| Calibration dataset | ❓ | 2026-10-30 | — | Hwashin Q2: images used during conversion to pick each layer's value range (scale); site / public / mixed, 50-500 images. |
| Quantization algorithm and granularity (normal / mmse / kl_divergence, per-channel / per-layer) | ❓ | 2026-10-30 | — | Hwashin Q2: rknn-toolkit2 options for choosing the value range and how finely it is applied. |
| Hybrid (mixed-precision) quantization | ❓ | 2026-10-30 | — | Hwashin Q2: keep high-error layers in FP16 and the rest INT8; layers chosen from accuracy_analysis in Q1. |

## Operating Systems

No items recorded yet.

## Development Tools

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Git repository | ❓ | 2026-10-07 | — | Used to store and synchronize the global Codex knowledge records across devices. |
| Symbolic link | ❓ | 2026-10-07 | — | Used to connect files in the cloned repository to the corresponding files under `~/.codex`. |
| Codex global `AGENTS.md` | ❓ | 2026-10-07 | — | Used to provide instructions that Codex loads globally before project-specific instructions. |

## Experiment / Evaluation

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Train/validation split (time-based vs random) | ❓ | 2026-10-09 | — | Hwashin: 939 video frames split 80/20 by time (0-750 / 751-938) because a random split leaks near-identical neighbouring frames into training. |
| CRC-32 checksum | ❓ | 2026-10-23 | — | Hwashin: per-frame CRC-32 of the 416x224 RGB model input, compared between the LuckFox board and the server reproduction (939/939 match) to prove identical inputs. |
| Grounded question-answering prompt design | ❓ | 2026-10-07 | — | QA prompting research: constrain answers to supplied evidence, require explicit abstention when evidence is insufficient, and specify answer/citation formats. |
| LLM evaluation metrics and judge bias | ❓ | 2026-10-07 | — | QA prompting research: use task-appropriate metrics and human checks; automated LLM judges can show position, verbosity, and leniency biases. |

## Web Graphics

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| 3D asset hierarchy versus materials and surface scans | ❓ | 2026-10-09 | — | Architecture candidate research: an FBX format, material count, or detailed scan does not prove separable architectural members. Inspect object hierarchy, names and hidden surfaces before promising layer-by-layer exploration. |
| Multi-resolution map tiles and full-map coverage | ❓ | 2026-10-07 | — | Architecture: combine a complete national overview with high-resolution tiles around the selected building so camera movement does not expose missing regions. |
| CSS 3D perspective and camera framing | ❓ | 2026-10-07 | — | Architecture: tilt the map while retaining its focused scale; full-map data extends the ground outside the previous viewport. An earlier fit-all-corners zoom-out was removed after user clarification. This is a flat historic map under perspective, not reconstructed 3D terrain. |
| WebGL scene preloading with iframe and postMessage | ❓ | 2026-10-07 | — | Architecture: retain the prepared Three.js scene in a same-origin iframe and transition only after a readiness message, avoiding another model/GPU reload. |
| Camera dolly and animation easing | ⬜ | 2026-10-07 | 2026-10-07 | User explicitly said this is new and requested an explanation. Explained CSS map approach versus actual Three.js camera translation, acceleration, and deceleration in the Architecture transition. Understanding not yet confirmed; do not promote based on the explanation alone. |
| Scroll-driven 3D narrative and progressive enhancement | ❓ | 2026-10-08 | — | Architecture alternate entrance: ordinary HTML text and SVG diagrams work immediately; scroll position selects and interpolates camera viewpoints after the unchanged full-detail model is ready. Reading never depends on a timed loading screen. |

## Document Automation

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| HWPX template structure and rendering | ❓ | 2026-10-07 | — | Course-description forms: retained the supplied ZIP/XML template, filled cells from Excel/report sources, and used local @rhwp/core rendering to check pagination and clipping. Rendering may substitute fonts unavailable on this Mac; original font references were retained. |

## Web Application Architecture

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Next.js App Router full-stack architecture | ❓ | 2026-10-07 | — | Multi-AI Group Chat MVP: colocates the React UI and server route handlers in one deployable application. |
| Browser localStorage versus server persistence | ❓ | 2026-10-07 | — | Multi-AI Group Chat MVP: keeps prototype conversations and memory across refreshes on one browser, without account synchronization or trusted server storage. |
| Request schema validation with Zod | ❓ | 2026-10-07 | — | Multi-AI Group Chat MVP: validates message shape, lengths, agent ids, and memory limits at the server boundary. |

## LLM Application Architecture

| Item | Status | Date Added | Last Confirmed | Notes |
|---|---|---|---|---|
| Multi-provider LLM adapter and server-only API keys | ❓ | 2026-10-07 | — | Multi-AI Group Chat MVP: presents one generation contract over OpenAI, Anthropic, Gemini, and Moonshot Kimi while keeping credentials out of the browser. |
| Shared Memory using profile and conversation summary | ❓ | 2026-10-07 | — | Multi-AI Group Chat MVP: gives every selected model common user preferences and a compact room summary; automatic extraction and vectors are deferred. |
| Rule-based speaker selection and sequential turn-taking | ❓ | 2026-10-07 | — | Multi-AI Group Chat MVP: selects at most two agents using mentions, semantic cues, and rotation, then lets the later agent read the earlier reply. |
| CLI-based multi-agent orchestration with a shared transcript | 🟡 | 2026-10-08 | 2026-10-08 | AI-Roundtable reference study: user is familiar with a local coordinator invoking already-authenticated provider CLIs and giving each selected assistant the labeled shared transcript before its turn, but may need a review to explain it. |
| Cross-platform CLI process lifecycle and streaming event normalization | 🟡 | 2026-10-08 | 2026-10-08 | AI-Roundtable difficulty review: user is familiar with starting and stopping provider process trees on macOS/Linux/Windows, feeding prompts through stdin or temporary files, and normalizing different JSON event streams into one UI protocol, but may need a review. |
| Localhost and LAN security boundary for a local AI bridge | 🟡 | 2026-10-08 | 2026-10-08 | AI-Roundtable difficulty review: user is familiar with protecting loopback endpoints, authenticating LAN sessions, and separating local control operations from remote chat access, but may need a review. |
| Jev typed decision API | ❓ | 2026-10-09 | — | Considered for Multi-AI Group Chat: Jev evaluates supplied state and returns predefined choices, scores, or typed judgments; it is not a transcript database or chat-history persistence API, but could later assist speaker selection or routing. |
| Event-driven multi-agent workspace with launcher and provider adapters | 🟡 | 2026-10-10 | 2026-10-10 | OpenAgents reference study: user is familiar with a central workspace persisting thread events while a local launcher daemon runs provider-specific CLI adapters, maintains per-channel sessions, polls targeted events, and streams normalized responses back, but may need a review. |
| LLM-based dynamic speaker routing | 🟡 | 2026-10-10 | 2026-10-10 | OpenAgents reference study: user is familiar with a small router model examining recent conversation and participant descriptions to choose a next agent or stop, with deterministic mentions and loop-prevention rules, but may need a review. |
