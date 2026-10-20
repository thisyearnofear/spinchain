"use client";

import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform, Vector2 } from "three";

/**
 * RadialBlurEffect — peripheral blur for the sensation of speed.
 *
 * Velocity is not perceived from the speed number. The eye compresses and
 * blurs the *periphery* of vision as speed rises, which is why racing games
 * fake it with a radial blur toward the edges of the frame rather than a
 * uniform screen blur. This effect does exactly that: the blur amount grows
 * with the distance from the vanishing point, so the centre of the frame
 * (the rider, the road ahead) stays sharp while the world smears past.
 *
 * Cost: five texture fetches per pixel, one convolution pass.
 */
const fragmentShader = /* glsl */ `
uniform float uStrength;
uniform vec2 uCenter;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 dir = uv - uCenter;
  float dist = length(dir);

  // Peripheral falloff: nothing at the vanishing point, most at the corners.
  float amount = uStrength * smoothstep(0.04, 0.72, dist);
  if (amount < 0.0008) {
    outputColor = inputColor;
    return;
  }

  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 5; i++) {
    float t = float(i) / 4.0;
    float weight = 1.0 - t * 0.55;
    sum += texture2D(inputBuffer, uCenter + dir * (1.0 - amount * t)) * weight;
    total += weight;
  }
  outputColor = sum / total;
}
`;

export class RadialBlurEffect extends Effect {
  constructor({ strength = 0, center = new Vector2(0.5, 0.45) }: { strength?: number; center?: Vector2 } = {}) {
    super("RadialBlurEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      // CONVOLUTION puts the effect in its own pass with the frame as a
      // texture — required for anything that samples `inputBuffer`.
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["uStrength", new Uniform(strength)],
        ["uCenter", new Uniform(center)],
      ]),
    });
  }

  get strength(): number {
    return this.uniforms.get("uStrength")!.value;
  }

  set strength(value: number) {
    this.uniforms.get("uStrength")!.value = value;
  }
}
