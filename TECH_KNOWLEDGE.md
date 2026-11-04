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

No items recorded yet.

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
