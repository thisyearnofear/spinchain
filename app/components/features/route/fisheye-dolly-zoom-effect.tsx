"use client";

import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform, Vector2 } from "three";

/**
 * FisheyeDollyZoomEffect — the wide-angle half of the ride lens.
 *
 * The camera dolly (see `ride-lens.ts`) gives the effect its depth: the subject
 * holds its size while the horizon's parallax grows. This pass adds the *lens*
 * half — a radial bow that magnifies the centre and leaves the furthest corner
 * exactly where it was, so straight features bend at the edges with no black
 * border and no clamp smear.
 *
 * Three things have to line up with the camera, all from one width:
 *  - `uCurve` is the same curve the capture tangent was overscanned by. Any
 *    drift between the two shows up as the rider growing or shrinking.
 *  - `uCenter` is the rider's *projected* position, measured after the camera
 *    and the shake offsets are final for the frame, so the magnification is
 *    centred on the person rather than the frame.
 *  - `uMaxRadiusSq` is the furthest corner's squared distance, which normalises
 *    the radial term so radius 1 is the frame edge in every direction.
 *
 * At width 0 the uniform falls under the threshold and the pass is a straight
 * copy — the shipped lens renders unchanged.
 *
 * Cost: one texture fetch per pixel, one pass. Cheaper than the peripheral
 * blur it sits next to, so it runs on the medium tier too.
 */
const fragmentShader = /* glsl */ `
uniform float uCurve;
uniform vec2 uCenter;
uniform float uAspect;
uniform float uMaxRadiusSq;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uCurve < 0.0004) {
    outputColor = inputColor;
    return;
  }

  // Aspect-correct first: the radial falloff has to be circular on screen or
  // the bow reads as a horizontal squash on a wide monitor.
  vec2 delta = uv - uCenter;
  delta.x *= uAspect;

  // Normalise so radius 1 is the furthest corner, and clamp for safety —
  // lensSampleRadius(1) is exactly 1, so this only ever catches rounding.
  float r2 = min(1.0, dot(delta, delta) / max(uMaxRadiusSq, 0.0001));
  float k = (1.0 + uCurve * r2) / (1.0 + uCurve);

  vec2 sampleDelta = delta * k;
  sampleDelta.x /= uAspect;

  outputColor = texture2D(inputBuffer, clamp(uCenter + sampleDelta, vec2(0.0), vec2(1.0)));
}
`;

export class FisheyeDollyZoomEffect extends Effect {
  constructor({
    curve = 0,
    center = new Vector2(0.5, 0.5),
    aspect = 1,
    maxRadiusSq = 0.5,
  }: {
    curve?: number;
    center?: Vector2;
    aspect?: number;
    maxRadiusSq?: number;
  } = {}) {
    super("FisheyeDollyZoomEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      // CONVOLUTION puts the effect in its own pass with the frame as a
      // texture — required for anything that samples `inputBuffer`.
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["uCurve", new Uniform(curve)],
        ["uCenter", new Uniform(center)],
        ["uAspect", new Uniform(aspect)],
        ["uMaxRadiusSq", new Uniform(maxRadiusSq)],
      ]),
    });
  }

  get curve(): number {
    return this.uniforms.get("uCurve")!.value;
  }

  set curve(value: number) {
    this.uniforms.get("uCurve")!.value = value;
  }

  /** Writes the anchor uniforms in place — no per-frame allocation. */
  setAnchor(anchorX: number, anchorY: number, aspect: number, maxRadiusSq: number): void {
    const center = this.uniforms.get("uCenter")!.value as Vector2;
    if (center.x !== anchorX || center.y !== anchorY) center.set(anchorX, anchorY);
    this.uniforms.get("uAspect")!.value = aspect;
    this.uniforms.get("uMaxRadiusSq")!.value = maxRadiusSq;
  }
}
