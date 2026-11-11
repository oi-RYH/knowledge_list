# Design

The visual world of the museum as built. Product facts live in `PRODUCT.md`; how to run and extend it lives in `museum/README.md`.

## The world

A round tower standing in the sea in late-afternoon sun, hollow from top to bottom: a well. A ramp winds down the inside of its wall, around the open shaft. The records stand along the ramp, each facing the shaft, so from anywhere the visitor sees the steles across the shaft and on the turns above and below. The newest record stands at the top; the oldest is at the bottom.

The presence that judges hovers in the middle of the shaft, level with the visitor, all the way down. Above the sea the wall is an arcade open to water and sky. Below it the wall is closed, and at the bottom lies a dark mirror floor where the trial is held. The top is all daylight and white surfaces; the bottom has a single light. Nothing separates the two but the descent: there is no door between keeping knowledge and being tested on it.

Nothing is framed, labelled or hung. The exhibits are stone steles standing on the ramp. The interface is a column of dots and at most one sentence.

## Light

Light is the subject, in the way Joaquín Sorolla used it.

- One low sun (20° above the horizon), warm, on the far side from the entry. It comes in through the arches on its own side, crosses the shaft, and lands on the steles opposite. Its bearing is set a quarter of a bay off the arches so that each arch's light falls on a stele and not between two.
- Shade is never grey. It is lit by sky from the arches and the open top and by sunlight bounced off the ramp, so shadows lean violet and undersides lean warm. This is computed (light probes that follow the ramp); the paint only leans further the way the light already leans.
- Sunlit white is allowed to reach white. The tone curve rolls highlights off late so linen in full sun keeps its folds.
- Air is visible only where the sun crosses it, and it is thin: the shaft is wide, and thicker air would white out the view towards the sun.
- Below the sea the light is the presence. It throws the columns' shadows outward across the ramp and up the wall; a few last patches of sun still reach the far side of the first turns under the water. Its colour is its speech: gold-white to affirm, violet and dim to deny.

## Palette

Taken from the materials, not chosen as swatches.

| Role | Value | Where |
|---|---|---|
| Plaster | `#f6ecd8` (lit) | wall, undersides of the ramp, page background while loading |
| Stone ink | `#2e241a` | text in the plain version |
| Soft ink | `#6b5a47` | secondary text in the plain version |
| Sun-white | `#fffaf0` | interface marks and captions up in the light |
| Gold | `#f0cf8e` | interface down in the dark, inlay, gilding |
| Night | `#0b0a0e` | the depths, scrims behind text |
| Sea | turquoise to deep blue | outside only; never used in the interface |

Colour in the interface is restrained: one near-white above the sea, one gold below it. The scene carries all saturation.

## Type

Hahmlet (600 and 700), a Korean serif with enough contrast to read as cut stone and enough Latin to set names like `YOLOv5n` and `Next.js App Router` without a fallback face. It is used for the inscriptions and for every word of interface. No second family.

- Inscriptions: 700, sized so the longest word of a title fits one line; up to five lines.
- Caption: 600, 15–19px, centred, balanced wrap.
- Trial question: 600, 17–25px. Choices: 400, 14–16.5px.
- Tracking between -0.01em and -0.015em. No all-caps, no eyebrows, no numerals as decoration.

## Materials

| Material | Use |
|---|---|
| Lime plaster | the wall and the undersides of the ramp; darker and damp below the sea |
| Honed limestone | columns, the edge of the ramp, sills, skirting, footings and plinths |
| Pale stone slabs | the ramp |
| Bronze | the rail on the edge of the shaft |
| Linen | veils over unreviewed steles |
| White marble with gilding | known |
| Limestone with dark-filled lettering | familiar |
| Rough basalt, lettering only scratched | not learned |
| Black marble with gold inlay | the floor of the well; it reflects the presence |

Understanding is told by material, never by a badge or a word.

## Motion

Slow, weighted, and caused by something: the visitor walking, wind in cloth, the presence turning.

- Walking eases towards where the scroll points, down and round. The feet keep to the ramp.
- The head is the visitor's. A drag takes hold of the scene and pulls it, exactly as far as the pointer moves, all the way round and nearly straight up and down; let go while moving, it carries on a little and comes to rest, and taking hold again stops it. Pulled past straight up or down it gives slightly and springs back. Stepping up to a stone faces it squarely, and arriving on the floor of the well draws the gaze to the presence once; after either, the head is free again.
- Any stele in sight can be chosen. A near one is walked to along the ramp. A far one is flown to: the camera leaves the ramp between two columns, crosses the shaft keeping its distance from the presence, and comes in between two columns on the other side. Long jumps from the dots travel the same way.
- The unveiling is the signature: the sheet is drawn back over the top of the stone, falls behind it and is gone, in a little over two seconds. It is laid back when the visitor steps away.
- Veils stir slightly at rest and more under the pointer, wherever in the well they are.
- The presence keeps level with the visitor, following a moment behind.
- The page opens from white, as eyes do coming in from the sun.
- Interface elements fade and move a few pixels on an exponential ease-out. Nothing bounces.
- With reduced motion requested: no head bob, no travel or flight animation, near-instant interface transitions.

## Paint

The picture is oil paint, after the way Sorolla handled it. Everything under Light is still computed first, as a camera would see it; that picture is then looked at again with a painter's eye and laid down in brush strokes. (`?paint=0`, or P while looking, shows the camera's picture instead.)

What makes a Sorolla a Sorolla, and not a soft impression, is held to here:

- **Things are distinct.** A stroke belongs to one thing. It never takes its colour from another thing and never runs over an outline, so a white sheet stands clear of the white wall behind it. Outlines fall exactly where the things end.
- **Shadow has colour.** Sunlit white is warm. Its shadow is not grey: planes that face the sky take the sky's blue-violet, planes that face the floor take the warm light the sunlit floor throws back, and planes that stand take the sky's colour unless the light on them is already clearly warm. Where the sun falls is taken from the sun's own shadow, not guessed from brightness.
- **Colour is varied.** The sea is deep: violet-blue far out, turquoise close in, its foam and glitter left white. It is not stroked: its own waves are its brushwork, and no stroke of sky dips below the horizon. Far out, where a wave is smaller than a pixel, it is laid in calm, a band of colour with a few long level streaks; a wave too small to draw is not drawn, because it could only flicker. The sky is blue. The ramp is a warm stone and the wall plaster a shade deeper than linen, so materials part from one another. No two loads of the brush are the same mixture.
- **Strokes are few and broad.** Broad ones everywhere; smaller ones only where the picture has something that small to show, and none smaller than a small brush: folds are drawn, not stippled. They follow what they are on: upright on what stands or hangs, round with the ramp, level across the sky. They belong to the surfaces, stay put as the visitor walks, and grow as the visitor steps up to them.
- **The surface is a canvas.** Light from the upper left rakes the bristle marks, and the weave shows where the paint is thin. There is no border, edge or frame.
- **The last touches go in sharply:** glitter on the water, the rail, a letter's edge. Before a stone the visitor has stepped up to, what is cut into it is drawn in with a fine brush, so the name can be read.
- **The presence is not painted.** It is light. Below the sea, where it is the only light and its colour is its speech, the painter's eye stands back.

## Interface

- **Rail**: one dot per day on which records were added, newest at the top, like the well itself; a short line separates the months; a diamond marks the floor where the trial is held. A dot's name appears only while it is hovered or focused.
- **Caption**: one sentence about the stele the visitor has stepped up to, bottom centre, over a soft dark scrim.
- **Back**: a small cross, top right, only while stepped up to a stele.
- **Trial**: the question and four choices, bottom centre, on the floor of the well. After an answer the right choice stays lit and the others recede; there is no "correct" or "wrong" text.
- **Sound**: a small speaker, bottom left. Off until asked for.
- **Loading**: plaster-coloured light and a hairline that fills with the work actually done. No words.

## Rules

- No frames, cards, plaques or captions attached to exhibits.
- No text that light, material or motion can replace.
- No status words. No counts or scores, and nothing that measures the visitor on screen.
- The interface never uses a colour that is not already in the scene behind it.
- Anything new stands in the building and obeys its light.
- Columns stand under the arches and steles before the piers, so nothing ever stands between the presence and a stele.
