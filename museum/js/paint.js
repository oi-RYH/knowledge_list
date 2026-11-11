// The picture as paint. After the camera has made its image (post.js), this lays it down again in
// brush strokes, the way Sorolla worked: broad strokes first, smaller ones only where there is
// something for them to say, and each stroke one load of colour.
//
// A stroke takes its colour from the picture where its middle falls, as broadly as the stroke is
// wide, and stops wherever the picture stops looking like that colour, so the edge of a patch of
// sun stays an edge. The strokes belong to the surfaces, not to the screen: they are laid out on
// the wall, the ramp and the stones in the well's own coordinates (bearing, height, radius), so
// they stay where they are as the visitor walks, and each surface carries them in every size, of
// which the four that come out between a small brush and a broad one on the screen are used: the
// broad ones everywhere, the smaller the fewer, and only where the picture has something that
// small to show. Sea and sky are too far away to have a place, so theirs are laid out by direction.
//
// A second pass treats the result as a painted canvas: light rakes the relief of the paint, the
// weave shows where the paint is thin, and what the brushwork could not hold (glitter on the water,
// a letter's edge) is put back in sharply, as the last touches of a painting are. The presence is
// the one thing left unpainted: it is light, and where its light shows the picture is left as it is.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FULLSCREEN_VERT, HASH, TILE_NOISE } from './glsl.js';

const COPY = /* glsl */ `
uniform sampler2D tDiffuse; varying vec2 vUv;
void main(){ gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.); }`;

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

vec4 clip0, clipU, clipV;           // where a point of this surface falls on the screen: clip0 + du * clipU + dv * clipV
vec3 here, broadly;                 // the picture at this pixel, seen a hair wide and a big brush wide

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
  height = mix(height, body * (.6 + .12 * load + .08 * ridge + .26 * bristly * (hairs - .5)), a);
}

// One size of stroke. uvm: this pixel on its surface; s: the short side of a cell, in the same units;
// along: 0 strokes run along u, 1 along v; girth: cells of this size around the well (0: the surface does not close);
// size: how large the stroke comes out on the screen, in doublings of the smallest brush (-1 .. 3).
void lay(vec2 uvm, float s, float along, float girth, vec2 seed, float cellPx, float size, inout vec3 paint, inout float height){
  vec2 ax = along > .5 ? vec2(1., 2.) : vec2(2., 1.);
  vec2 q = uvm / (s * ax);
  vec2 base = floor(q);
  float wrap = girth / ax.x;
  float lod = max(log2(cellPx) - 1., 0.);
  float soft = clamp(1.3 / cellPx + .05, .05, .5);          // wet into wet: the broad strokes' edges are a little soft
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
    float ang = (h.z - .5) * uSpread + lean;
    vec2 dir = along > .5 ? vec2(-sin(ang), cos(ang)) : vec2(cos(ang), sin(ang));
    float al = dot(d, dir), ac = dot(d, vec2(-dir.y, dir.x));
    float len = mix(1.25, 2.3, h.w), wid = mix(.32, .52, fract(h.w * 7.31 + h.z * 3.17));
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
    vec2 at = cl.w > 1e-4 ? clamp(cl.xy / cl.w * .5 + .5, 0., 1.) : vUv;
    vec3 col = textureLod(tSrc, at, lod).rgb;
    // it stops where the picture stops looking like it
    m *= 1. - smoothstep(uLike.x, uLike.y, apart(col, here));
    // Broad strokes are always there. A smaller one is there only if it differs from what a broad one would lay in,
    // and the smaller it is the more it must differ. Because this goes by the stroke's size on the screen and nothing
    // else, strokes come and go one at a time, and slowly, as the visitor's distance to them changes.
    float say = smoothstep(uSay.x, uSay.y, apart(col, broadly));
    float prob = mix(smoothstep(1.3, 2.2, size), smoothstep(-.8, -.3, size), say);
    m *= clamp((prob - fract(h.x * 13.7 + h.y * 29.3)) / .26 + .5, 0., 1.);
    if (m < .004) continue;
    // broken colour: no two loads of the brush are quite the same mixture, warmer or cooler
    float l = lum(col);
    float warm = fract(h.y * 41.3 + h.z * 7.7) * 2. - 1.;
    vec3 mixed = col * (1. + warm * uBroken * mix(2.2, 1., l) * vec3(1., .1, -1.));
    col = mixed * (l / max(lum(mixed), 1e-4)) * (1. + (fract(h.x * 57.1 + h.w * 3.3) - .5) * uBroken * 1.2);
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

  vec2 uvm; float closes = 0.; float cls; float L = 0.; float unit; vec3 runs;   // runs.x: which way the strokes go (0 along u, 1 along v)
  if (depth > .99999 || r > uWell.x) {
    // sea and sky: laid out by direction, on the faces of a cube around the eye
    vec3 D = normalize(P - uCamPos), a = abs(D), A, B, C;
    if (a.y > a.x && a.y > a.z) { C = vec3(0., sign(D.y), 0.); A = vec3(1., 0., 0.); B = vec3(0., 0., 1.); cls = D.y > 0. ? 4. : 5.; }
    else if (a.x > a.z) { C = vec3(sign(D.x), 0., 0.); A = vec3(0., 0., 1.); B = vec3(0., 1., 0.); cls = D.x > 0. ? 6. : 7.; }
    else { C = vec3(0., 0., sign(D.z)); A = vec3(1., 0., 0.); B = vec3(0., 1., 0.); cls = D.z > 0. ? 8. : 9.; }
    uvm = vec2(dot(D, A), dot(D, B)) / dot(D, C);
    clip0 = uViewProj * vec4(C + A * uvm.x + B * uvm.y, 0.);
    clipU = uViewProj * vec4(A, 0.); clipV = uViewProj * vec4(B, 0.);
    unit = uCell / uFocal;
    L = .6;                                                   // broader strokes than indoors, smaller ones only where the water glitters
    runs = vec3(0.);                                          // level strokes, as water and sky are painted
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
  }
  float n = floor(L), f = L - n;
  float cp = uCell * exp2(-f);                                // the smallest cell's short side on the screen, pixels
  here = textureLod(tSrc, vUv, 1.).rgb;
  broadly = textureLod(tSrc, vUv, log2(cp * 6.) + .5).rgb;
  vec3 paint = textureLod(tSrc, vUv, 1.6).rgb;                // the ground the strokes go over: the picture rubbed in thinly
  float height = .06;
  for (int k = 3; k >= 0; k--) {
    if (k == 0 && f > .8) continue;                           // the smallest size has faded out by here
    float j = n + float(k);
    float along = cls == 3. ? mod(j, 2.) : runs.x;            // on the floor of the well every other size goes the other way
    lay(uvm, unit * exp2(j), along, closes * 4096. / exp2(j), vec2(j * 37.13 + cls * 101.7, j * 11.71 + cls * 53.3),
        cp * exp2(float(k)), float(k) - f, paint, height);
  }
  gl_FragColor = vec4(paint, height);
}`;

const FINISH = /* glsl */ `
uniform sampler2D tPaint;           // the strokes: colour, and in alpha how thick the paint lies
uniform sampler2D tDiffuse;         // the picture as the camera made it
uniform sampler2D tSoft;            // and the same seen broadly
uniform float uRead;                // 1 while the visitor stands before a stone to read it
uniform vec2 uPaintTexel; uniform float uThread;
uniform highp sampler2D tDepth; uniform mat4 uProjInv;
uniform vec4 uOrb;                  // the presence: its middle as the camera sees it, and its radius
uniform float uRelief; uniform float uGloss; uniform float uCanvas; uniform float uTouch; uniform float uChroma; uniform float uSplit;
varying vec2 vUv;
${HASH}
float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
void main(){
  vec4 p = texture2D(tPaint, vUv);
  vec3 c = p.rgb; float h = p.a;
  // the last touches: what the brushwork could not hold goes in sharply, the lights in thicker paint
  vec3 sharp = texture2D(tDiffuse, vUv).rgb;
  float d = lum(sharp) - lum(c);
  float touch = smoothstep(.09, .24, d) + .75 * smoothstep(.13, .32, -d);
  touch = max(touch, smoothstep(.86, .98, lum(sharp)) * smoothstep(.02, .1, d));   // and the purest lights go in last, pure: glitter on water, the lines of the presence
  touch = min(1., touch * uTouch);
  // the presence is light, not paint: where it shines, and nothing stands in front of it, the picture stays as the camera made it
  vec4 far = uProjInv * vec4(vUv * 2. - 1., 1., 1.);
  vec3 ray = normalize(far.xyz / far.w);
  float along = dot(uOrb.xyz, ray);
  float miss = (dot(uOrb.xyz, uOrb.xyz) - along * along) / (uOrb.w * uOrb.w);
  float light = 0.;
  if (along > 0. && miss < 1.) {
    vec4 v = uProjInv * vec4(vUv * 2. - 1., texture2D(tDepth, vUv).x * 2. - 1., 1.);
    light = (1. - smoothstep(.5, 1., miss)) * step(along - uOrb.w * .5, length(v.xyz / v.w)) * smoothstep(.3, .7, lum(sharp));
  }
  touch = max(touch, light);
  // before a stone the visitor has stepped up to, what is cut into it is drawn in with a fine brush, however faint
  vec3 fineLine = sharp - textureLod(tSoft, vUv, 2.6).rgb;
  float cut = uRead * smoothstep(.025, .07, abs(lum(fineLine)));
  c = mix(c, sharp, touch);
  c += fineLine * cut * (1. - touch) * 2.;
  h += touch * .35 * step(0., d);
  // Sorolla's white: warm where the sun is on it, and in shadow the colour of the sky
  float grey = lum(c); vec3 tint = c - grey;
  float faint = 1. - smoothstep(.06, .26, length(tint));
  float shade = 1. - smoothstep(.52, .9, grey);
  c += mix(vec3(.008, .002, -.012), vec3(-.046, -.023, .066), shade) * uSplit * faint * smoothstep(.15, .5, grey);
  // and a painter sees more colour in a white wall than a camera does: faint tints are pushed furthest
  grey = lum(c); tint = c - grey;
  c = grey + tint * mix(uChroma, 1., smoothstep(.0, .22, length(tint)));
  // the canvas: a plain weave, uneven as linen is, showing most where the paint is thin
  vec2 w = gl_FragCoord.xy / uThread;
  vec2 cell = floor(w), fr = fract(w) - .5;
  float thread = mod(cell.x + cell.y, 2.) > .5
    ? cos(fr.x * 3.14159) * (.75 + .5 * hash21(vec2(cell.x, floor(cell.y * .25))))
    : cos(fr.y * 3.14159) * (.75 + .5 * hash21(vec2(floor(cell.x * .25), cell.y) + 7.));
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
   * @param well { outer, mid, floor }: the wall's outer radius, the radius bearings are measured out at, and the radius inside which the floor has its own layout
   */
  constructor(camera, depth, well = { outer: 17, mid: 13.6, floor: 10.4 }) {
    super();
    this.camera = camera;
    this.scale = 0.7;                 // the strokes are laid at this fraction of the picture's size; the finish is at full size
    this.stroke = 0.0075;             // short side of the smallest stroke's cell, as a fraction of the picture's height
    this.width = this.height = 4;
    this.density = 2;                 // pixels of the picture per CSS pixel
    this.relief = 0.36;               // how strongly light rakes the paint, for a picture a thousand pixels high
    this.canvas = 0.05;               // how much the weave shows
    this.orb = new THREE.Vector4(0, 0, 0, 0);   // the presence, where it is in the world and how large: set by whoever moves it
    // the picture, small and with mips: a stroke reads its colour from the level that is as coarse as the stroke is wide
    this.source = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.strokes = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    const material = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ uniforms, vertexShader: FULLSCREEN_VERT, fragmentShader, depthTest: false, depthWrite: false });
    this.copy = material(COPY, { tDiffuse: { value: null } });
    this.lay = material(STROKES, {
      tSrc: { value: this.source.texture }, tDepth: { value: depth },
      uProjInv: { value: new THREE.Matrix4() }, uViewInv: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() }, uDepthTexel: { value: new THREE.Vector2(1, 1) },
      uFocal: { value: 1000 }, uCell: { value: 9 },
      uS0: { value: (Math.PI * 2 * well.mid) / 4096 },
      uWell: { value: new THREE.Vector3(well.outer, well.mid, well.floor) },
      uSpread: { value: 0.44 },                                // how far a stroke may lean on its own, radians end to end
      uLean: { value: 0.4 },                                   // and how far its neighbourhood leans together                                 // how far a stroke may lean from the way its size runs, radians end to end
      uLike: { value: new THREE.Vector2(0.055, 0.15) },         // a stroke holds where the picture is this close to its colour .. and gives way by here
      uSay: { value: new THREE.Vector2(0.045, 0.13) },          // a smaller stroke is wanted once it differs this much from the broad lay-in
      uBroken: { value: 0.028 },                               // how far one load of the brush strays, warm or cool
      uBody: { value: 1 },                                     // how thick the paint lies
    });
    this.finish = material(FINISH, {
      tPaint: { value: this.strokes.texture }, tDiffuse: { value: null }, tSoft: { value: this.source.texture }, tDepth: { value: depth },
      uRead: { value: 0 },
      uProjInv: { value: new THREE.Matrix4() }, uOrb: { value: new THREE.Vector4(0, 0, -1, 0) },
      uPaintTexel: { value: new THREE.Vector2(1, 1) }, uThread: { value: 3 },
      uRelief: { value: 0.36 }, uGloss: { value: 0.07 }, uCanvas: { value: 0.05 }, uTouch: { value: 1 }, uChroma: { value: 1.4 }, uSplit: { value: 1 },
    });
    this.quad = new FullScreenQuad(this.copy);
  }

  setDepth(depth) { this.lay.uniforms.tDepth.value = depth; this.finish.uniforms.tDepth.value = depth; }

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
    this.source.setSize(pw, ph);
    this.strokes.setSize(pw, ph);
    this.lay.uniforms.uDepthTexel.value.set(1 / w, 1 / h);
    this.lay.uniforms.uCell.value = Math.max(4.5, ph * this.stroke);
    this.finish.uniforms.uPaintTexel.value.set(1 / pw, 1 / ph);
    this.finish.uniforms.uThread.value = Math.max(2.5, h / 420);   // some four hundred threads up the picture
    this.finish.uniforms.uCanvas.value = this.canvas * THREE.MathUtils.smoothstep(this.density, 1.1, 1.5);
    this.finish.uniforms.uRelief.value = this.relief * Math.min(1.25, ph / 1030);   // the same slope of paint, whatever the size it is laid at
  }

  render(renderer, writeBuffer, readBuffer) {
    const u = this.lay.uniforms, cam = this.camera;
    this.copy.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.copy;
    renderer.setRenderTarget(this.source);
    this.quad.render(renderer);

    u.uProjInv.value.copy(cam.projectionMatrixInverse);
    u.uViewInv.value.copy(cam.matrixWorld);
    u.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    u.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
    u.uFocal.value = 0.5 * this.strokes.height * cam.projectionMatrix.elements[5];
    this.quad.material = this.lay;
    renderer.setRenderTarget(this.strokes);
    this.quad.render(renderer);

    const f = this.finish.uniforms;
    f.tDiffuse.value = readBuffer.texture;
    f.uProjInv.value.copy(cam.projectionMatrixInverse);
    const o = f.uOrb.value.copy(this.orb), e = cam.matrixWorldInverse.elements, { x, y, z } = this.orb;
    o.x = e[0] * x + e[4] * y + e[8] * z + e[12];
    o.y = e[1] * x + e[5] * y + e[9] * z + e[13];
    o.z = e[2] * x + e[6] * y + e[10] * z + e[14];
    this.quad.material = this.finish;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.source.dispose(); this.strokes.dispose();
    this.copy.dispose(); this.lay.dispose(); this.finish.dispose();
    this.quad.dispose();
  }
}
