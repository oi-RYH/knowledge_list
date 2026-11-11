// The picture as paint. After the camera has made its image (post.js), this lays it down again in
// oil, the way Sorolla worked. Three things make his pictures his, and each is a pass here.
//
// 1. The painter's eye. He saw more colour than a camera: sunlit white is warm, and its shadow is
//    not grey but the colour of whatever lights it, the sky from above and the sunlit ground from
//    below. The sea is deep blue and violet, not haze. So before any paint is laid the picture is
//    looked at again: where the sun falls is taken from the sun's own shadow map, which way a
//    surface faces from the depth buffer, and each part is given the colour he would have mixed.
//
// 2. The strokes. Broad ones everywhere, smaller ones only where there is something that small
//    to show, each one load of colour taken from the picture where the stroke's middle falls. A
//    stroke belongs to one thing: it is laid out on that thing's surface, in the well's own
//    coordinates (bearing, height, radius), so it stays put as the visitor walks, and it never
//    takes its colour from another thing or runs over the edge onto one. That keeps every outline
//    as clean as he kept them. Sea and sky are too far to have a place and are laid out by
//    direction. They are painted alike, so that they belong to one picture: level strokes of a
//    middling brush, each a slightly different blue, thinly laid; the sky's melt into one another,
//    the sea's stay distinct. A stroke of sky never dips below the horizon.
//
// 3. The canvas. Light rakes the relief of the paint, the weave shows where the paint is thin,
//    and the last touches go in sharply: glitter on the water, a rail, a letter's edge. The
//    presence is the one thing left unpainted: it is light.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FULLSCREEN_VERT, HASH, TILE_NOISE } from './glsl.js';

const EYE = /* glsl */ `
#include <packing>
uniform sampler2D tDiffuse; uniform highp sampler2D tDepth; uniform sampler2D tShadow;
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform mat4 uShadowMatrix;
uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec2 uDepthTexel; uniform vec2 uShadowTexel;
uniform vec3 uWell;                 // outer radius; the radius bearings are measured out at; radius of the floor of the well
uniform vec3 uHelix;                // metres the ramp falls for each radian of bearing; the rise of one turn; its height at bearing zero
uniform float uPalette;             // how far the painter's eye goes: 1 in daylight, less where the only light is the presence's
uniform float uSunK;                // 0 until the sun's shadow has been drawn
uniform float uShadowPx;            // texels of the sun's shadow map that one pixel of the picture covers, a metre away
uniform float uFocal;               // pixels per unit of tangent, at the picture's size
varying vec2 vUv;
${HASH}
float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x), mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
}
vec3 viewAt(vec2 uv){
  vec4 v = uProjInv * vec4(uv * 2. - 1., texture2D(tDepth, uv).x * 2. - 1., 1.);
  return v.xyz / v.w;
}
// 1 where the sun reaches a point, 0 where something stands in its way. The answer is taken over a few texels
// (the spread), so that the edge of a shadow is no sharper than the picture's own pixels and does not step.
float sunAt(vec3 p, float spread){
  vec4 sc = uShadowMatrix * vec4(p, 1.);
  if (sc.x <= 0. || sc.x >= 1. || sc.y <= 0. || sc.y >= 1. || sc.z >= 1.) return 1.;
  float lit = 0.;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 o = (vec2(float(i), float(j)) - .5) * spread * uShadowTexel;
    lit += step(sc.z - .0009, unpackRGBAToDepth(texture2D(tShadow, sc.xy + o)));
  }
  return lit * .25;
}
void main(){
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float depth = texture2D(tDepth, vUv).x;
  vec3 vc = viewAt(vUv);
  vec3 P = (uViewInv * vec4(vc, 1.)).xyz;
  float r = length(P.xz);
  float grey = lum(c);
  if (depth > .99999 || r > uWell.x) {
    vec3 d = normalize(P - uCamPos);
    if (depth > .99999) {
      // the sky: blue, deepening overhead; round the sun it stays pale and warm
      vec3 blue = mix(vec3(.70, .83, .96), vec3(.34, .54, .90), pow(clamp(d.y, 0., 1.), .55));
      float glare = smoothstep(.80, .99, max(dot(d, uSunDir), 0.));
      c = mix(c, blue * (.5 + .62 * grey), uPalette * .82 * (1. - glare));
    } else {
      // The sea: violet-blue far out, deep turquoise close in, and its foam and glitter left white.
      // Far out its waves are smaller than a pixel, and what the camera has of them there is only noise that jumps
      // from frame to frame. So the sea is read as the average of a few pixels, and beyond a few hundred metres it
      // is laid in calm, as a distant sea is: a band of colour with a few long level streaks.
      float dist = length(P - uCamPos);
      vec2 px = uDepthTexel * 1.5;
      vec4 around = vec4(lum(texture2D(tDiffuse, vUv + vec2(px.x, 0.)).rgb), lum(texture2D(tDiffuse, vUv - vec2(px.x, 0.)).rgb),
                         lum(texture2D(tDiffuse, vUv + vec2(0., px.y)).rgb), lum(texture2D(tDiffuse, vUv - vec2(0., px.y)).rgb));
      around = mix(around, vec4(grey), step(.2, abs(around - grey)));           // a neighbour that is not sea (a wall, a rail) is left out
      float soft = (grey * 2. + around.x + around.y + around.z + around.w) / 6.;
      float calm = smoothstep(50., 380., dist);
      float seen = mix(grey, soft, smoothstep(25., 90., dist));
      float wave = mix(seen + (seen - .7) * 1.5, .7, calm);
      float az = atan(d.x, d.z), el = asin(clamp(d.y, -1., 0.));
      float band = uFocal / 5.5;                                                // a streak is some five pixels thick, whatever the picture's size
      float streak = 1. + (vnoise(vec2(az * band / 28., el * band)) - .5) * .11 * calm;
      vec3 water = mix(vec3(.30, .36, .74), vec3(.05, .36, .62), smoothstep(.015, .4, clamp(-d.y, 0., 1.)));
      water += (vnoise(vec2(az * band / 60., el * band * .45) + 9.) - .5) * vec3(.05, -.012, -.035) * calm;
      c = mix(c, mix(water * (.2 + 1.05 * wave) * streak, vec3(1.), smoothstep(.76, .96, seen) * (1. - calm)), uPalette * mix(.88, .985, calm));
    }
  } else {
    // which way the surface faces, judged over a few pixels so that the facets of a mesh do not show as patches of colour
    vec2 reach = uDepthTexel * 2.5;
    vec3 vl = viewAt(vUv - vec2(reach.x, 0.)), vr = viewAt(vUv + vec2(reach.x, 0.));
    vec3 vd = viewAt(vUv - vec2(0., reach.y)), vu = viewAt(vUv + vec2(0., reach.y));
    vec3 dx = abs(vl.z - vc.z) < abs(vr.z - vc.z) ? vc - vl : vr - vc;
    vec3 dy = abs(vd.z - vc.z) < abs(vu.z - vc.z) ? vc - vd : vu - vc;
    vec3 N = normalize(mat3(uViewInv) * cross(dx, dy));
    float h = mod(P.y + uHelix.x * atan(P.x, P.z) - uHelix.z, uHelix.y);        // how high this is above the turn of the ramp below it
    // plaster, stone and linen take this; bronze, gilding, basalt and the black floor are left as they are
    float k = (1. - smoothstep(.12, .36, length(c - grey))) * smoothstep(.3, .55, grey) * uPalette;
    // How much of the light here is what the sunlit floor throws back. A plane that faces the sky gets none of it;
    // one that faces the floor gets it wherever the camera's picture shows any warmth; one that stands gets it only
    // where the picture is clearly warm. So the paint leans further the way the light already leans, and no further.
    float warmth = (c.r - c.b) / max(grey, .05);
    float glow = mix(smoothstep(.17, .30, warmth), smoothstep(.10, .20, warmth), smoothstep(.1, -.55, N.y)) * (1. - smoothstep(.3, .7, N.y));
    // what things are made of differs a little more than a camera shows: the ramp is a warm stone, the wall plaster a shade deeper than linen
    float ramp = step(.6, N.y) * (1. - smoothstep(.10, .24, min(h, uHelix.y - h))) * step(uWell.z, r);
    c *= mix(vec3(1.), vec3(1.05, .975, .86), ramp * k);                        // (its warmth shows in the sun; in shade the sky's colour takes over, below)
    c *= mix(vec3(1.), vec3(.985, .955, .915), step(uWell.x - 1.25, r) * (1. - ramp) * k);
    // where the sun falls; and whatever is as bright as sunlight is lit, by the lamp if not by the sun
    float lit = uSunK > .5 ? sunAt(P + N * .07, max(1.6, length(P - uCamPos) * uShadowPx * 1.4)) * smoothstep(-.05, .3, dot(N, uSunDir)) : 1.;
    lit = max(lit, smoothstep(.9, .97, grey));
    grey = lum(c);
    // Shadow is lit by the sky and by what the sunlit floor throws back, and takes their colours. Which of the two
    // reaches a place is not guessed: it is read from the picture, and the paint only leans further the way the light leans.
    vec3 fill = mix(vec3(.90, .985, 1.30), vec3(1.19, .955, .70), glow);
    c = mix(c, grey * .93 * fill, (1. - lit) * k * mix(mix(.62, .86, clamp(N.y, 0., 1.)), .72, glow));
    c *= mix(vec3(1.), vec3(1.012, 1., .965), lit * k);                          // and the sun itself is a little gold
  }
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`;

const STROKES = /* glsl */ `
uniform sampler2D tSrc;             // the finished picture, with its mip chain: the same picture seen ever more broadly
uniform highp sampler2D tDepth;
uniform mat4 uProjInv; uniform mat4 uViewInv; uniform mat4 uViewProj;
uniform vec3 uCamPos; uniform vec2 uDepthTexel;
uniform float uFocal;               // pixels per unit of tangent, at this target's size
uniform float uCell;                // short side of the smallest stroke's cell, in pixels of this target
uniform float uS0;                  // the smallest size strokes come in on a surface, metres; the well's girth is 4096 of them
uniform vec3 uWell;                 // outer radius; the radius bearings are measured out at; radius of the floor's own layout
uniform float uSpread; uniform float uLean; uniform vec2 uLike; uniform vec2 uSay; uniform float uBroken; uniform float uBody;
uniform float uLodShift;            // the picture is larger than this target by this many doublings
uniform float cameraNear; uniform float cameraFar;
varying vec2 vUv;
${HASH}
${TILE_NOISE}
vec4 hash42(vec2 p){
  vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}
float vn1(float x){ float i = floor(x), f = x - i; f = f * f * (3. - 2. * f); return mix(hash11(i), hash11(i + 1.), f); }
float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
// how unlike two colours look
float apart(vec3 a, vec3 b){ return length((a - b) * vec3(.55, .72, .42)); }
vec3 viewAt(vec2 uv){
  vec4 v = uProjInv * vec4(uv * 2. - 1., texture2D(tDepth, uv).x * 2. - 1., 1.);
  return v.xyz / v.w;
}

// how far from the eye the nearest thing is, looking through a point of the screen
float eyeDepth(vec2 uv){ return cameraNear * cameraFar / (cameraFar - texture2D(tDepth, uv).x * (cameraFar - cameraNear)); }

vec4 clip0, clipU, clipV;           // where a point of this surface falls on the screen: clip0 + du * clipU + dv * clipV
vec3 here, broadly;                 // the picture at this pixel, seen a hair wide and a big brush wide
float solid;                        // 1 on a thing in the well, whose strokes must stay on it; 0 on sea and sky
bool open;                          // this pixel is open sky
float mine;                         // how far from the eye this pixel's own surface is
float stray;                        // how far a load of the brush may stray in colour here
float kind;                         // 0 a thing in the well, 1 the sea, 2 the sky
vec2 like;                          // the range over which a stroke gives way to the picture here
float melt;                         // how soft a stroke's edge is here: wet into wet in the sky
float thick;                        // how thick the paint lies here

// one stroke over what is already there
void dab(vec3 col, float a, vec3 g, float cellPx, inout vec3 paint, inout float height){
  float across = g.y + .05 * sin(g.x * 5. + g.z);
  float fine = clamp(cellPx * .15, 1., 6.);                                                  // no finer than the picture can hold
  float second = .4 * smoothstep(18., 38., cellPx);
  float hairs = (vn1(across * fine + g.z) * .6 + vn1(across * fine * 2.7 + g.z * 2.3) * second) / (.6 + second);   // the grooves the bristles leave
  float load = .5 - g.x * .5;                                                                // most paint where the brush lands
  float ridge = smoothstep(.55, .97, abs(g.y));                                              // and a little pushed out to the edges
  float body = uBody * mix(.45, 1., smoothstep(.3, .95, lum(col)));                          // the lights are laid on thickest
  float bristly = mix(.35, 1., smoothstep(5., 20., cellPx));                                 // a small brush leaves a smoother dab
  paint = mix(paint, col * (1. + (hairs - .5) * .08 * bristly), a);
  height = mix(height, thick * body * (.6 + .12 * load + .08 * ridge + .26 * bristly * (hairs - .5)), a);
}

// One size of stroke. uvm: this pixel on its surface; s: the short side of a cell, in the same units;
// along: 0 strokes run along u, 1 along v; girth: cells of this size around the well (0: the surface does not close);
// size: how large the stroke comes out on the screen, in doublings of the smallest brush (-1 .. 3).
void lay(vec2 uvm, float s, float along, float girth, vec2 seed, float cellPx, float size, inout vec3 paint, inout float height){
  vec2 ax = along > .5 ? vec2(1., 2.) : vec2(2., 1.);
  vec2 q = uvm / (s * ax);
  vec2 base = floor(q);
  float wrap = girth / ax.x;
  // (sea and sky are read more narrowly: they are smooth already, and a broad reading would take in the wall beside them)
  float lod = max(log2(cellPx) - (kind > .5 ? 2.5 : 1.), 0.) + uLodShift;
  float soft = clamp(1.1 / cellPx + .02 + melt, .02, .5);   // a clean edge, a pixel or so of softness; softer where strokes melt together
  // neighbouring strokes lean the same way, as a hand's do; the lean closes round the well with the strokes
  float lean = wrap >= 4. ? pnoise(q * .25 + seed.yx, wrap * .25) : wrap > 0. ? .5 : pnoise(q * .25 + seed.yx, 4096.);
  lean = (lean - .5) * uLean;
  float p1 = -1., p2 = -1., a1 = 0., a2 = 0.;
  vec3 c1 = vec3(0.), c2 = vec3(0.), g1 = vec3(0.), g2 = vec3(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    // the cells are laid like bricks, each course half a cell on from the last, so strokes never line up in ranks
    vec2 cell, lap = vec2(0.);
    if (along > .5) { cell.x = base.x + float(i); lap.y = .5 * mod(cell.x, 2.); cell.y = floor(q.y - lap.y) + float(j); }
    else { cell.y = base.y + float(j); lap.x = .5 * mod(cell.y, 2.); cell.x = floor(q.x - lap.x) + float(i); }
    vec4 h = hash42(vec2(wrap > 0. ? mod(cell.x, wrap) : cell.x, cell.y) + seed);
    vec2 c = cell + .5 + lap + (h.xy - .5) * .6;
    vec2 d = (q - c) * ax;                                   // from the stroke's middle, in short sides of a cell
    float ang = ((h.z - .5) * uSpread + lean) * (kind > .5 ? .3 : 1.);       // sea and sky are laid level
    vec2 dir = along > .5 ? vec2(-sin(ang), cos(ang)) : vec2(cos(ang), sin(ang));
    float al = dot(d, dir), ac = dot(d, vec2(-dir.y, dir.x));
    float len = mix(1.25, 2.3, h.w), wid = mix(.32, .52, fract(h.w * 7.31 + h.z * 3.17)) * (kind > .5 && kind < 1.5 ? .7 : 1.);   // the sea's strokes are slender: lines of water
    float along01 = al / len;
    ac -= (fract(h.x * 23.9 + h.w * 11.3) - .5) * 1.3 * wid * (along01 * along01 - .35);   // the wrist turns: a stroke is a shallow arc
    if (abs(al) > len || abs(ac) > wid * 1.16) continue;
    // a brush is a bundle of bristles: its edge wavers, and it runs dry in streaks where it lifts
    float key = h.z * 61.7 + h.w * 17.3;
    float tip = len * (1. - (al > 0. ? mix(.14, .42, smoothstep(6., 22., cellPx)) : .12) * vn1(ac / wid * 3.2 + key));
    float rim = wid * (.86 + .3 * vn1(al * 1.1 + key * 1.7)) * mix(1., .72, smoothstep(.15, 1., along01));   // and narrows as the brush lifts
    float m = (1. - smoothstep(rim - soft, rim, abs(ac))) * (1. - smoothstep(tip - soft * 1.5, tip, abs(al)));
    if (m < .004) continue;
    // its colour is the picture's at its middle, taken as broadly as the stroke is wide
    vec2 dm = (c - q) * ax * s;
    vec4 cl = clip0 + clipU * dm.x + clipV * dm.y;
    vec2 at = cl.w > 1e-4 ? cl.xy / cl.w * .5 + .5 : vUv;
    // A stroke belongs to one thing. If what is seen at its middle is something else (the stroke's middle is hidden
    // behind another thing, or lies past this thing's edge), it is not laid here, and no outline is painted across.
    if (solid > .5 && at.x > 0. && at.x < 1. && at.y > 0. && at.y < 1. && abs(eyeDepth(at) - cl.w) > .025 * cl.w + .1) continue;
    // nor does a stroke of sky dip below the horizon, or a stroke of sea or sky take its colour from the wall beside it
    if (solid < .5 && at.x > 0. && at.x < 1. && at.y > 0. && at.y < 1.) {
      float there = texture2D(tDepth, at).x;
      if ((there > .99999) != open) continue;
      if (!open && cameraNear * cameraFar / (cameraFar - there * (cameraFar - cameraNear)) < mine * .5) continue;
    }
    vec3 col = textureLod(tSrc, clamp(at, 0., 1.), lod).rgb;
    // it stops where the picture stops looking like it
    m *= 1. - smoothstep(like.x, like.y, apart(col, here));
    // Broad strokes are always there. A smaller one is there only if it differs from what a broad one would lay in,
    // and the smaller it is the more it must differ. Because this goes by the stroke's size on the screen and nothing
    // else, strokes come and go one at a time, and slowly, as the visitor's distance to them changes.
    float say = smoothstep(uSay.x, uSay.y, apart(col, broadly));
    float prob = mix(smoothstep(1.3, 2.2, size), smoothstep(-.5, .1, size), say);     // nothing smaller than a small brush: folds are drawn, not stippled
    m *= clamp((prob - fract(h.x * 13.7 + h.y * 29.3)) / .26 + .5, 0., 1.);
    if (m < .004) continue;
    // broken colour: no two loads of the brush are quite the same mixture: warmer or cooler, rosier or greener
    float l = lum(col);
    float warm = fract(h.y * 41.3 + h.z * 7.7) * 2. - 1., rose = fract(h.z * 23.1 + h.x * 5.9) * 2. - 1.;
    vec3 mixed = col * (1. + uBroken * stray * mix(2.2, 1., l) * (warm * vec3(1., .1, -1.) + rose * vec3(.3, -.36, .3)));
    col = mixed * (l / max(lum(mixed), 1e-4)) * (1. + (fract(h.x * 57.1 + h.w * 3.3) - .5) * uBroken * stray * 1.2);
    if (kind > .5) {
      // Water and sky are many blues at once, but not at random: the colour runs in long level bands, as lines of
      // waves and layers of air do, and a stroke takes the colour of the band it lies in, give or take a little.
      vec2 mid = c * ax * s;                                                  // where the stroke lies: bearing and height
      bool water = kind < 1.5;
      vec2 grain = water ? vec2(7., 95.) : vec2(3.2, 26.);
      float bandA = pnoise(mid * grain + 31., 4096.) - .5, bandB = pnoise(mid * grain * vec2(.6, .47) + 77., 4096.) - .5;
      float own = fract(h.x * 57.1 + h.w * 3.3) - .5;
      float catchLight = water ? smoothstep(.9, 1., fract(h.z * 19.3 + h.y * 3.1)) * smoothstep(.02, .2, -mid.y) : 0.;   // near water, now and then a stroke catches the light
      float much = water ? 1. : .3;
      col = col * (1. + (bandA * .32 + own * .09 + catchLight * .2) * much) + (bandB * 1.6 + warm * .3) * vec3(-.045, .036, -.008) * much;
    }
    float pr = fract(h.w * 5.13 + h.x * 9.71);               // which stroke was laid over which
    vec3 g = vec3(al / len, ac / rim, key);
    if (pr > p1) { p2 = p1; c2 = c1; a2 = a1; g2 = g1; p1 = pr; c1 = col; a1 = m; g1 = g; }
    else if (pr > p2) { p2 = pr; c2 = col; a2 = m; g2 = g; }
  }
  if (a2 > 0.) dab(c2, a2, g2, cellPx, paint, height);
  if (a1 > 0.) dab(c1, a1, g1, cellPx, paint, height);
}

void main(){
  float depth = texture2D(tDepth, vUv).x;
  vec3 vc = viewAt(vUv);
  vec3 P = (uViewInv * vec4(vc, 1.)).xyz;
  float r = length(P.xz);
  open = depth > .99999;
  mine = -vc.z;

  float finer = 0.;                 // how many doublings smaller than its place in the scheme the brush is here
  vec2 uvm; float closes = 0.; float cls; float L = 0.; float unit; vec3 runs;   // runs.x: which way the strokes go (0 along u, 1 along v)
  if (depth > .99999 || r > uWell.x) {
    // Sea and sky: laid out by direction, as bearing and height in Mercator's way. That keeps angles, so a brush mark
    // has the same shape everywhere; the strokes lie level along the horizon and circle the zenith overhead, with no
    // seam anywhere, and the size is chosen as on a surface, so they are no smaller up there than at the horizon.
    vec3 D = normalize(P - uCamPos);
    float el = clamp(asin(clamp(D.y, -1., 1.)), -1.5, 1.5), ce = cos(el);
    uvm = vec2(atan(D.x, D.z), log(tan(.7853982 + el * .5)));
    clip0 = uViewProj * vec4(D, 0.);
    clipU = uViewProj * vec4(D.z, 0., -D.x, 0.);
    clipV = uViewProj * vec4(-D.y * D.x, ce * ce, -D.y * D.z, 0.);
    unit = 6.2831853 / 4096.;
    closes = 1.; cls = 4.;
    // a middling brush for both, the sea's a little smaller than the sky's, so the two belong to one picture
    finer = open ? .7 : 1.;
    L = clamp(log2(uCell / (uFocal * unit * ce)) - finer, -3., 8.);
    runs = vec3(0.);                                          // level strokes, as water and sky are painted
    solid = 0.; stray = 0.; kind = open ? 2. : 1.;
    like = open ? vec2(.12, .2) : vec2(.22, .34);             // a stroke of sea rides over the waves; only a wall or the sky stops it
    melt = open ? .14 : .03; thick = open ? .28 : .62;        // thin paint, the sky's strokes melting into one another
  } else {
    // the well: which way the surface faces decides which two of bearing, height and radius it is laid out in
    vec3 vl = viewAt(vUv - vec2(uDepthTexel.x, 0.)), vr = viewAt(vUv + vec2(uDepthTexel.x, 0.));
    vec3 vd = viewAt(vUv - vec2(0., uDepthTexel.y)), vu = viewAt(vUv + vec2(0., uDepthTexel.y));
    vec3 dx = abs(vl.z - vc.z) < abs(vr.z - vc.z) ? vc - vl : vr - vc;
    vec3 dy = abs(vd.z - vc.z) < abs(vu.z - vc.z) ? vc - vd : vu - vc;
    vec3 N = normalize(mat3(uViewInv) * cross(dx, dy));
    vec2 rh = P.xz / max(r, 1e-3);
    vec3 er = vec3(rh.x, 0., rh.y), et = vec3(rh.y, 0., -rh.x);
    float th = atan(P.x, P.z);
    vec3 w = abs(vec3(dot(N, er), N.y, dot(N, et)));
    vec3 gu, gv;
    if (w.y > w.x && w.y > w.z) {
      if (r < uWell.z) { cls = 3.; uvm = P.xz; gu = vec3(1., 0., 0.); gv = vec3(0., 0., 1.); runs = vec3(0., 1., 0.); }       // the floor of the well
      else { cls = 1.; uvm = vec2(th * uWell.y, r); gu = et * (uWell.y / r); gv = er; closes = 1.; runs = vec3(0.); }          // the ramp: strokes follow it round
    } else if (w.x >= w.z) {
      cls = r > uWell.x - 1.2 ? 0. : r > uWell.z + 1.8 ? .37 : .71;    // the wall; the stones before it; the columns at the shaft's edge
      uvm = vec2(th * uWell.y, P.y); gu = et * (uWell.y / r); gv = vec3(0., 1., 0.); closes = 1.; runs = vec3(1.);            // the wall, the stones, the linen: upright strokes, the way all of them hang or stand
    } else {
      cls = 2.; uvm = vec2(r, P.y); gu = er; gv = vec3(0., 1., 0.); runs = vec3(1.);                                           // jambs and sides: upright strokes
    }
    vec3 T = normalize(cross(N, gv)), B = normalize(cross(N, gu));
    float tu = dot(gu, T), bv = dot(gv, B);
    T /= abs(tu) < .2 ? (tu < 0. ? -.2 : .2) : tu;
    B /= abs(bv) < .2 ? (bv < 0. ? -.2 : .2) : bv;
    clip0 = uViewProj * vec4(P, 1.); clipU = uViewProj * vec4(T, 0.); clipV = uViewProj * vec4(B, 0.);
    // The size that comes out one brush wide on the screen here. It goes by distance, not by depth, so that looking
    // about changes nothing. A surface seen edge-on takes a bigger size, so its strokes run long instead of thin;
    // what is far gets a somewhat smaller brush; and within three metres the size holds, so the strokes simply
    // grow as the visitor steps up to them, as they do on a canvas.
    float far = length(P - uCamPos);
    float graze = clamp(abs(dot(N, uCamPos - P)) / far, .25, 1.);
    L = clamp(log2(max(far, 3.) * uCell / (uFocal * uS0 * graze)) - .7 * smoothstep(10., 34., far), -6., 7.);
    unit = uS0;
    solid = 1.; stray = 1.; kind = 0.; like = uLike; melt = 0.; thick = 1.;
  }
  float n = floor(L), f = L - n;
  float cp = uCell * exp2(-f);                                // the smallest cell's short side on the screen, pixels
  here = textureLod(tSrc, vUv, 1. + uLodShift).rgb;
  broadly = textureLod(tSrc, vUv, log2(cp * 6.) + .5 + uLodShift).rgb;
  // the ground the strokes go over: the picture itself, so nothing shows through an edge but the thing's own colour
  // (read a little more softly on sea and sky, where a gap between strokes should not show a ripple sharply)
  vec3 paint = textureLod(tSrc, vUv, (kind > .5 ? 1.2 : 0.) + uLodShift).rgb;
  float height = .06;
  for (int k = 3; k >= 0; k--) {
    if (k == 0 && f > .5) continue;                           // the smallest size has faded out by here
    float j = n + float(k);
    float along = cls == 3. ? mod(j, 2.) : runs.x;            // on the floor of the well every other size goes the other way
    lay(uvm, unit * exp2(j), along, closes * 4096. / exp2(j), vec2(j * 37.13 + cls * 101.7, j * 11.71 + cls * 53.3),
        cp * exp2(float(k) - finer), float(k) - f, paint, height);
  }
  gl_FragColor = vec4(paint, height);
}`;

const FINISH = /* glsl */ `
uniform sampler2D tPaint;           // the strokes: colour, and in alpha how thick the paint lies
uniform sampler2D tSoft;            // the picture as the painter saw it, with its mip chain
uniform float uSoftLod;             // the level of it that is a small brush wide
uniform float uRead;                // 1 while the visitor stands before a stone to read it
uniform vec2 uPaintTexel; uniform float uThread;
uniform highp sampler2D tDepth; uniform mat4 uProjInv; uniform mat4 uViewInv; uniform float cameraNear; uniform float cameraFar;
uniform float uShore;               // the wall's outer radius: beyond it lies the sea
uniform vec4 uOrb;                  // the presence: its middle as the camera sees it, and its radius
uniform float uRelief; uniform float uGloss; uniform float uCanvas; uniform float uTouch;
varying vec2 vUv;
${HASH}
float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
float eyeDepth(vec2 uv){ return cameraNear * cameraFar / (cameraFar - texture2D(tDepth, uv).x * (cameraFar - cameraNear)); }
void main(){
  // The strokes were laid on a coarser grid than the screen. At the edge of a thing they are taken from the thing's
  // own side of the edge, so the outline falls exactly where the thing ends.
  vec2 st = vUv / uPaintTexel - .5, corner = floor(st), fr = st - corner;
  float z0 = eyeDepth(vUv);
  vec4 p = vec4(0.); float ws = 0.;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 uv = (corner + vec2(float(i), float(j)) + .5) * uPaintTexel;
    float off = (eyeDepth(uv) - z0) / (.012 * z0 + .02);
    float w = ((i == 0 ? 1. - fr.x : fr.x) * (j == 0 ? 1. - fr.y : fr.y) + .01) / (1. + off * off);
    p += texture2D(tPaint, uv) * w; ws += w;
  }
  p /= ws;
  vec3 c = p.rgb; float h = p.a;
  // the last touches: what the brushwork could not hold goes in sharply, the lights in thicker paint
  vec3 sharp = textureLod(tSoft, vUv, 0.).rgb;
  float d = lum(sharp) - lum(c);
  float touch = smoothstep(.09, .24, d) + .75 * smoothstep(.13, .32, -d);
  touch = max(touch, smoothstep(.86, .98, lum(sharp)) * smoothstep(.02, .1, d));   // and the purest lights go in last, pure: glitter on water, the lines of the presence
  touch = min(1., touch * uTouch);
  // the presence is light, not paint: where it shines, and nothing stands in front of it, the picture stays as it was
  vec4 far = uProjInv * vec4(vUv * 2. - 1., 1., 1.);
  vec3 ray = normalize(far.xyz / far.w);
  float along = dot(uOrb.xyz, ray);
  float miss = (dot(uOrb.xyz, uOrb.xyz) - along * along) / (uOrb.w * uOrb.w);
  float deep = texture2D(tDepth, vUv).x;
  vec4 v = uProjInv * vec4(vUv * 2. - 1., deep * 2. - 1., 1.);
  vec3 seen = v.xyz / v.w;
  float light = 0.;
  if (along > 0. && miss < 1.) light = (1. - smoothstep(.5, 1., miss)) * step(along - uOrb.w * .5, length(seen)) * smoothstep(.3, .7, lum(sharp));
  // On the sea only the glitter goes in sharply. Its waves are painted, like everything else: put back sharply they
  // would show through the strokes as a photograph shows through paint.
  float sea = deep < .99999 && length((uViewInv * vec4(seen, 1.)).xz) > uShore ? 1. : 0.;
  touch = mix(touch, smoothstep(.86, .98, lum(sharp)) * smoothstep(.02, .1, d), sea);
  touch = max(touch, light);
  // before a stone the visitor has stepped up to, what is cut into it is drawn in with a fine brush, however faint
  vec3 fineLine = sharp - textureLod(tSoft, vUv, uSoftLod).rgb;
  float cut = uRead * smoothstep(.025, .07, abs(lum(fineLine)));
  c = mix(c, sharp, touch);
  c += fineLine * cut * (1. - touch) * 2.;
  h += touch * .35 * step(0., d);
  // the canvas: a plain weave, uneven as linen is, showing most where the paint is thin
  vec2 w = gl_FragCoord.xy / uThread;
  vec2 cell = floor(w), fw = fract(w) - .5;
  float thread = mod(cell.x + cell.y, 2.) > .5
    ? cos(fw.x * 3.14159) * (.75 + .5 * hash21(vec2(cell.x, floor(cell.y * .25))))
    : cos(fw.y * 3.14159) * (.75 + .5 * hash21(vec2(floor(cell.x * .25), cell.y) + 7.));
  float weave = (thread - .55) * mix(.3, 1., 1. - smoothstep(.1, .55, h)) * (1. - light);
  // light from the upper left rakes the relief of the paint
  vec2 t = uPaintTexel;
  vec2 g = vec2(texture2D(tPaint, vUv + vec2(t.x, 0.)).a - texture2D(tPaint, vUv - vec2(t.x, 0.)).a,
                texture2D(tPaint, vUv + vec2(0., t.y)).a - texture2D(tPaint, vUv - vec2(0., t.y)).a) * (1. - light);
  const vec3 LD = vec3(-.4575, .5490, .6997);
  float dif = clamp(1. - dot(g, LD.xy) * uRelief / LD.z, .72, 1.3);    // 1 on the flat, so the picture keeps its values
  vec3 n = normalize(vec3(-g * uRelief * 2., 1.));
  vec3 hv = normalize(LD + vec3(0., 0., 1.));
  float glint = max(pow(max(dot(n, hv), 0.), 40.) - pow(hv.z, 40.), 0.);
  c *= dif * (1. + weave * uCanvas);
  c += glint * uGloss * smoothstep(.15, .6, h);
  c += (hash21(gl_FragCoord.xy + 3.3) - .5) / 255.;           // dither against banding
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`;

export class PaintPass extends Pass {
  /**
   * @param camera the scene's camera
   * @param depth the scene's depth texture
   * @param place what the painter needs to know of the place:
   *   well { outer, mid, floor, helix }: the wall's outer radius, the radius bearings are measured out at, the radius of the
   *     floor of the well, and the ramp as [metres fallen per radian of bearing, rise of one turn, height at bearing zero];
   *   sun, sunDir: the sun's light (for its shadow map) and the direction towards it
   */
  constructor(camera, depth, { well = { outer: 17, mid: 13.6, floor: 10.4, helix: [1, 6.4, 0] }, sun = null, sunDir = new THREE.Vector3(0, 1, 0) } = {}) {
    super();
    this.camera = camera; this.sun = sun;
    this.scale = 0.7;                 // the strokes are laid at this fraction of the picture's size; the eye and the finish are at full size
    this.stroke = 0.0075;             // short side of the smallest stroke's cell, as a fraction of the picture's height
    this.width = this.height = 4;
    this.density = 2;                 // pixels of the picture per CSS pixel
    this.relief = 0.26;               // how strongly light rakes the paint, for a picture a thousand pixels high
    this.canvas = 0.05;               // how much the weave shows
    this.palette = 1;                 // how far the painter's eye goes: set by whoever knows how deep the visitor is
    this.orb = new THREE.Vector4(0, 0, 0, 0);   // the presence, where it is in the world and how large: set by whoever moves it
    // the picture as the painter sees it, with mips: a stroke reads its colour from the level that is as coarse as the stroke is wide
    this.source = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.strokes = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    const material = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: FULLSCREEN_VERT, fragmentShader, depthTest: false, depthWrite: false });
    const wellDims = new THREE.Vector3(well.outer, well.mid, well.floor);
    this.eye = material(EYE, {
      tDiffuse: { value: null }, tDepth: { value: depth }, tShadow: { value: null },
      uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uShadowMatrix: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() }, uSunDir: { value: sunDir },
      uDepthTexel: { value: new THREE.Vector2(1, 1) }, uShadowTexel: { value: new THREE.Vector2(1 / 4096, 1 / 4096) },
      uWell: { value: wellDims }, uHelix: { value: new THREE.Vector3(...well.helix) },
      uPalette: { value: 1 }, uSunK: { value: 0 }, uShadowPx: { value: 0.1 }, uFocal: { value: 1000 },
    });
    this.lay = material(STROKES, {
      tSrc: { value: this.source.texture }, tDepth: { value: depth },
      uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() }, uDepthTexel: { value: new THREE.Vector2(1, 1) },
      uFocal: { value: 1000 }, uCell: { value: 9 }, uLodShift: { value: 0.5 },
      cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
      uS0: { value: (Math.PI * 2 * well.mid) / 4096 },
      uWell: { value: wellDims },
      uSpread: { value: 0.44 },                                // how far a stroke may lean on its own, radians end to end
      uLean: { value: 0.4 },                                   // and how far its neighbourhood leans together
      uLike: { value: new THREE.Vector2(0.07, 0.13) },         // a stroke holds where the picture is this close to its colour .. and gives way by here
      uSay: { value: new THREE.Vector2(0.07, 0.17) },         // a smaller stroke is wanted once it differs this much from the broad lay-in
      uBroken: { value: 0.028 },                                // how far one load of the brush strays in colour
      uBody: { value: 1 },                                     // how thick the paint lies
    });
    this.finish = material(FINISH, {
      tPaint: { value: this.strokes.texture }, tSoft: { value: this.source.texture }, tDepth: { value: depth },
      uSoftLod: { value: 3.1 }, uRead: { value: 0 },
      uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uOrb: { value: new THREE.Vector4(0, 0, -1, 0) },
      uShore: { value: well.outer },
      cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
      uPaintTexel: { value: new THREE.Vector2(1, 1) }, uThread: { value: 3 },
      uRelief: { value: 0.26 }, uGloss: { value: 0.07 }, uCanvas: { value: 0.05 }, uTouch: { value: 1 },
    });
    this.quad = new FullScreenQuad(this.eye);
  }

  setDepth(depth) { for (const m of [this.eye, this.lay, this.finish]) m.uniforms.tDepth.value = depth; }

  setScale(scale) {
    if (scale === this.scale) return;
    this.scale = scale;
    this.setSize(this.width, this.height);
  }

  /** @param density pixels of the picture per CSS pixel: a coarse picture is stretched on the screen, and a weave drawn in it would look like a grid */
  setDensity(density) {
    this.density = density;
    this.setSize(this.width, this.height);
  }

  setSize(w, h) {
    this.width = w; this.height = h;
    const pw = Math.max(2, Math.round(w * this.scale)), ph = Math.max(2, Math.round(h * this.scale));
    const shift = Math.log2(h / ph);
    this.source.setSize(Math.round(w), Math.round(h));
    this.strokes.setSize(pw, ph);
    this.eye.uniforms.uDepthTexel.value.set(1 / w, 1 / h);
    this.lay.uniforms.uDepthTexel.value.set(1 / w, 1 / h);
    this.lay.uniforms.uCell.value = Math.max(4.5, ph * this.stroke);
    this.lay.uniforms.uLodShift.value = shift;
    this.finish.uniforms.uSoftLod.value = 2.6 + shift;
    this.finish.uniforms.uPaintTexel.value.set(1 / pw, 1 / ph);
    this.finish.uniforms.uThread.value = Math.max(2.5, h / 420);   // some four hundred threads up the picture
    this.finish.uniforms.uCanvas.value = this.canvas * THREE.MathUtils.smoothstep(this.density, 1.1, 1.5);
    this.finish.uniforms.uRelief.value = this.relief * Math.min(1.25, ph / 1030);   // the same slope of paint, whatever the size it is laid at
  }

  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera;
    // the painter's eye
    const e = this.eye.uniforms, shadow = this.sun?.shadow;
    e.tDiffuse.value = readBuffer.texture;
    e.uProjInv.value.copy(cam.projectionMatrixInverse);
    e.uViewInv.value.copy(cam.matrixWorld);
    e.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    e.uPalette.value = this.palette;
    e.uFocal.value = 0.5 * this.height * cam.projectionMatrix.elements[5];
    e.tShadow.value = shadow?.map ? shadow.map.texture : null;
    e.uSunK.value = shadow?.map ? 1 : 0;
    if (shadow?.map) {
      e.uShadowMatrix.value.copy(shadow.matrix);
      e.uShadowTexel.value.set(1 / shadow.mapSize.x, 1 / shadow.mapSize.y);
      e.uShadowPx.value = shadow.mapSize.x / (shadow.camera.right - shadow.camera.left) / (0.5 * this.height * cam.projectionMatrix.elements[5]);
    }
    this.quad.material = this.eye;
    renderer.setRenderTarget(this.source);
    this.quad.render(renderer);

    // the strokes
    const u = this.lay.uniforms;
    u.uProjInv.value.copy(cam.projectionMatrixInverse);
    u.uViewInv.value.copy(cam.matrixWorld);
    u.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    u.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    u.uFocal.value = 0.5 * this.strokes.height * cam.projectionMatrix.elements[5];
    u.cameraNear.value = cam.near; u.cameraFar.value = cam.far;
    this.quad.material = this.lay;
    renderer.setRenderTarget(this.strokes);
    this.quad.render(renderer);

    // the canvas
    const f = this.finish.uniforms;
    f.uProjInv.value.copy(cam.projectionMatrixInverse);
    f.uViewInv.value.copy(cam.matrixWorld);
    f.cameraNear.value = cam.near; f.cameraFar.value = cam.far;
    const o = f.uOrb.value.copy(this.orb), m = cam.matrixWorldInverse.elements, { x, y, z } = this.orb;
    o.x = m[0] * x + m[4] * y + m[8] * z + m[12];
    o.y = m[1] * x + m[5] * y + m[9] * z + m[13];
    o.z = m[2] * x + m[6] * y + m[10] * z + m[14];
    this.quad.material = this.finish;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.source.dispose(); this.strokes.dispose();
    this.eye.dispose(); this.lay.dispose(); this.finish.dispose();
    this.quad.dispose();
  }
}
