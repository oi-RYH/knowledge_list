// Planar reflection for the polished floor of the well. The scene is rendered once more from a camera
// mirrored about the floor plane; the floor material then reads that image as its specular reflection,
// blurred by roughness (via mipmaps) and weighted by Fresnel like any other reflection.

import * as THREE from 'three';

export class PlanarMirror {
  constructor(height = 0) {
    this.height = height;
    this.target = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.camera = new THREE.PerspectiveCamera();
    this.matrix = new THREE.Matrix4();
    this.uniforms = {
      tMirror: { value: this.target.texture },
      uMirrorMatrix: { value: this.matrix },
      uMirrorK: { value: 1 },
    };
    this.hidden = [];        // objects that must not appear in the reflection
    this.before = null;      // called before the reflection is drawn (e.g. to swap in cheaper geometry)
    this.after = null;
    this._plane = new THREE.Plane();
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
    this._v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this._rot = new THREE.Matrix4();
  }

  setSize(w, h) { this.target.setSize(Math.max(4, Math.round(w)), Math.max(4, Math.round(h))); }

  update(renderer, scene, camera) {
    const [camPos, view, look, tgt] = this._v;
    const normal = UP;
    const point = POINT.set(0, this.height, 0);
    camPos.setFromMatrixPosition(camera.matrixWorld);
    view.subVectors(point, camPos);
    if (view.dot(normal) > 0) return;                         // camera is below the floor

    view.reflect(normal).negate().add(point);
    this._rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(this._rot).add(camPos);
    tgt.subVectors(point, look).reflect(normal).negate().add(point);

    const v = this.camera;
    v.position.copy(view);
    v.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(normal);
    v.lookAt(tgt);
    v.near = camera.near; v.far = camera.far;
    v.updateMatrixWorld();
    v.projectionMatrix.copy(camera.projectionMatrix);

    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(v.projectionMatrix).multiply(v.matrixWorldInverse);

    // Clip everything below the floor with an oblique near plane (Lengyel).
    this._plane.setFromNormalAndCoplanarPoint(normal, point).applyMatrix4(v.matrixWorldInverse);
    const clip = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const p = v.projectionMatrix.elements;
    const q = this._q;
    q.x = (Math.sign(clip.x) + p[8]) / p[0];
    q.y = (Math.sign(clip.y) + p[9]) / p[5];
    q.z = -1;
    q.w = (1 + p[10]) / p[14];
    clip.multiplyScalar(2 / clip.dot(q));
    p[2] = clip.x; p[6] = clip.y; p[10] = clip.z + 1 - 0.003; p[14] = clip.w;

    this.before?.();
    const was = this.hidden.map((o) => o.visible);
    for (const o of this.hidden) o.visible = false;
    const k = this.uniforms.uMirrorK.value;
    this.uniforms.uMirrorK.value = 0;                          // the floor does not reflect itself
    renderer.setRenderTarget(this.target);
    renderer.render(scene, v);
    renderer.setRenderTarget(null);
    this.uniforms.uMirrorK.value = k;
    this.hidden.forEach((o, i) => { o.visible = was[i]; });
    this.after?.();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const POINT = new THREE.Vector3();

/** Hooks that make a planar-mapped PBR material reflect what the mirror saw. */
export const FLOOR_HOOKS = {
  pars: /* glsl */ `uniform sampler2D tMirror; uniform mat4 uMirrorMatrix; uniform float uMirrorK;`,
  light: /* glsl */ `
    {
      vec4 mc = uMirrorMatrix * vec4(vWPos, 1.);
      vec2 muv = mc.xy / mc.w + shadeN.xz * .06;
      float lod = clamp(material.roughness * 8.5, 0., 6.);
      vec3 mir = textureLod(tMirror, clamp(muv, .001, .999), lod).rgb;
      radiance = mix(radiance, mir, uMirrorK);
    }
  `,
};
