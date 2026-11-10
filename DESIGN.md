# Design

The visual world of the museum as built. Product facts live in `PRODUCT.md`; how to run and extend it lives in `museum/README.md`.

## The world

A vaulted seaside hall in late-afternoon sun, and a windowless rotunda at its end. The hall is where knowledge is kept; the rotunda is where it is tested. The two are opposites on purpose: one is all daylight and white surfaces, the other has a single light.

Nothing is framed, labelled or hung. The exhibits are stone steles standing on the floor. The interface is a column of dots and at most one sentence.

## Light

Light is the subject, in the way Joaquín Sorolla used it.

- One low sun (about 22° above the horizon) from the sea side, warm.
- Shade is never grey. It is lit by sky from the arches and by sunlight bounced off the floor, so shadows lean violet and undersides lean warm. This is computed (light probes), not painted.
- Sunlit white is allowed to reach white. The tone curve rolls highlights off late so linen in full sun keeps its folds.
- Air is visible only where the sun crosses it.
- In the rotunda the only light source is the presence. Its colour is its speech: gold-white to affirm, violet and dim to deny.

## Palette

Taken from the materials, not chosen as swatches.

| Role | Value | Where |
|---|---|---|
| Plaster | `#f6ecd8` (lit) | walls, vault, page background while loading |
| Stone ink | `#2e241a` | text in the plain version |
| Soft ink | `#6b5a47` | secondary text in the plain version |
| Sun-white | `#fffaf0` | interface marks and captions over the hall |
| Gold | `#f0cf8e` | interface in the rotunda, inlay, gilding |
| Night | `#0b0a0e` | rotunda, scrims behind text |
| Sea | turquoise to deep blue | outside only; never used in the interface |

Colour in the interface is restrained: one near-white over the hall, one gold over the rotunda. The scene carries all saturation.

## Type

Hahmlet (600 and 700), a Korean serif with enough contrast to read as cut stone and enough Latin to set names like `YOLOv5n` and `Next.js App Router` without a fallback face. It is used for the inscriptions and for every word of interface. No second family.

- Inscriptions: 700, sized so the longest word of a title fits one line; up to five lines.
- Caption: 600, 15–19px, centred, balanced wrap.
- Trial question: 600, 17–25px. Choices: 400, 14–16.5px.
- Tracking between -0.01em and -0.015em. No all-caps, no eyebrows, no numerals as decoration.

## Materials

| Material | Use |
|---|---|
| Lime plaster | walls and vault; trowel waves, fine grain |
| Honed limestone | piers' bases and imposts, cornice, ribs, plinths, rotunda columns |
| Pale stone slabs, partly wet | hall floor; reflects the building |
| Linen | veils over unreviewed steles |
| White marble with gilding | known |
| Limestone with dark-filled lettering | familiar |
| Rough basalt, lettering only scratched | not learned |
| Black marble with gold veins and inlay | rotunda |

Understanding is told by material, never by a badge or a word.

## Motion

Slow, weighted, and caused by something: the visitor walking, wind in cloth, the presence turning.

- Walking eases towards where the scroll points; long jumps accelerate and settle.
- The unveiling is the signature: the sheet is drawn back over the top of the stone, falls behind it and is gone, in a little over two seconds. It is laid back when the visitor steps away.
- Veils stir slightly at rest and more under the pointer.
- The page opens from white, as eyes do coming in from the sun.
- Interface elements fade and move a few pixels on an exponential ease-out. Nothing bounces.
- With reduced motion requested: no head bob, no travel animation, near-instant interface transitions.

## Interface

- **Rail**: one dot per category on the right edge; a short line separates the two wings; a diamond marks the rotunda. A dot's name appears only while it is hovered or focused.
- **Caption**: one sentence about the stele the visitor has stepped up to, bottom centre, over a soft dark scrim.
- **Back**: a small cross, top right, only while stepped up to a stele.
- **Trial**: the question and four choices, bottom centre of the rotunda. After an answer the right choice stays lit and the others recede; there is no "correct" or "wrong" text.
- **Sound**: a small speaker, bottom left. Off until asked for.
- **Loading**: plaster-coloured light with one slow point. No words.

## Rules

- No frames, cards, plaques or captions attached to exhibits.
- No text that light, material or motion can replace.
- No status words. No progress bars, counts or scores on screen.
- The interface never uses a colour that is not already in the scene behind it.
- Anything new stands in the building and obeys its light.
