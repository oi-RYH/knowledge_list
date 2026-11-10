// GLSL snippets shared by several shaders.

export const HASH = /* glsl */ `
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash31(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
`;

export const NOISE = /* glsl */ `
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float vnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x), mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x), mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++) { s += a * vnoise3(p); p = p * 2.02 + 11.3; a *= .5; } return s; }
`;

// Noise that repeats every `per` units, for textures that must tile.
export const TILE_NOISE = /* glsl */ `
float pnoise(vec2 p, float per){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  vec2 a = mod(i, per), b = mod(i + 1., per);
  return mix(mix(hash21(a), hash21(vec2(b.x, a.y)), f.x), mix(hash21(vec2(a.x, b.y)), hash21(b), f.x), f.y);
}
float pfbm(vec2 p, float per){
  float a = .5, s = 0.;
  for (int i = 0; i < 6; i++) { s += a * pnoise(p, per); p *= 2.; per *= 2.; a *= .5; }
  return s;
}
// Distance to the nearest cell point (x) and a random value for that cell (y).
vec2 pworley(vec2 p, float per){
  vec2 i = floor(p), f = fract(p); float d = 9.; float id = 0.;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)); vec2 c = mod(i + g, per);
    vec2 o = hash22(c); float dd = length(g + o - f);
    if (dd < d) { d = dd; id = hash21(c + 7.3); }
  }
  return vec2(d, id);
}
`;

// Sky radiance for a view direction. `uSun` is the direction towards the sun.
// `uSunDisk` switches the visible disc off while light probes are captured.
export const SKY = /* glsl */ `
uniform vec3 uSun;
uniform float uSunDisk;
vec3 skyRadiance(vec3 d){
  float h = clamp(d.y, -0.02, 1.);
  float mu = max(dot(d, uSun), 0.);
  // zenith blue falling to a pale, warm horizon
  vec3 zen = vec3(.14, .30, .72);
  vec3 hor = vec3(.86, .80, .70);
  vec3 c = mix(hor, zen, pow(smoothstep(0., 1., h), .42));
  // warm scattering around the low sun
  c += vec3(1.25, .82, .42) * pow(mu, 6.) * .55 * (1. - h * .6);
  c += vec3(1.6, 1.25, .8) * pow(mu, 48.) * .9;
  // the disc itself
  c += vec3(1., .86, .62) * uSunDisk * (smoothstep(.99972, .99990, mu) * 420. + pow(mu, 1400.) * 30.);
  // below the horizon: sea haze
  c = mix(c, vec3(.62, .64, .62), smoothstep(0., -.02, d.y));
  return c;
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;
