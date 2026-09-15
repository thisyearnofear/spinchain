"use client";

/**
 * AnimatedModel — GLB character with state-driven skeletal clip playback
 * for the route world (R3F).
 *
 * Mint's pipeline exports one clip per GLB (each self-contained: the same
 * rigged character mesh + a single animation). This component loads the
 * named clip GLBs, renders ONE cloned character, and crossfades between
 * clips when `activeClip` changes — clips share the same rig, so any clip
 * can drive the rendered skeleton.
 *
 * The mixer updates in useFrame, so speed changes never re-render React.
 * The scene is cloned with SkeletonUtils (safe for skinned meshes) and the
 * mixer is bound to the clone actually rendered — mixing on the source
 * scene would animate an object that never mounts.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AnimationMixer,
  SkinnedMesh,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

const CROSSFADE_SECONDS = 0.3;

export interface AvatarClipSource {
  /** State name used by the caller (e.g. "idle", "recovery", "celebrate"). */
  name: string;
  /** GLB carrying exactly one clip for this state (Mint per-clip export). */
  url: string;
}

export interface AnimatedModelProps {
  /** Base character GLB — rendered statically when no clips are provided. */
  url: string;
  /** Named per-clip GLBs (one animation each, all sharing the same rig). */
  clips?: AvatarClipSource[];
  /** Name of the clip to play; crossfades on change. Defaults to first. */
  activeClip?: string;
  /** Playback speed multiplier. 1 = authored speed. */
  timeScale?: number;
  scale?: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
}

function hasSkinnedMesh(root: Object3D): boolean {
  let found = false;
  root.traverse((child) => {
    if ((child as SkinnedMesh).isSkinnedMesh) found = true;
  });
  return found;
}

export function AnimatedModel({
  url,
  clips = [],
  activeClip,
  timeScale = 1,
  scale = 1,
  rotation = [0, 0, 0],
  position = [0, 0, 0],
}: AnimatedModelProps) {
  // No dedupe: useGLTF caches by URL, and keeping the array parallel to
  // [base, ...clips] lets clipMap below index by position.
  const urls = useMemo(() => [url, ...clips.map((c) => c.url)], [url, clips]);
  const gltfs = useGLTF(urls);

  // Render the first clip GLB whose scene has a skinned mesh (Mint clip
  // exports are self-contained); fall back to the base model scene.
  const renderSource = useMemo(() => {
    for (const gltf of gltfs.slice(1)) {
      if (gltf?.scene && hasSkinnedMesh(gltf.scene)) return gltf.scene;
    }
    return gltfs[0]?.scene;
  }, [gltfs]);

  // Map caller-facing state names → AnimationClips. Each Mint clip GLB
  // carries exactly one clip, aligned with the clips array order.
  const clipMap = useMemo(() => {
    const map = new Map<string, AnimationClip>();
    clips.forEach((spec, i) => {
      const clip = gltfs[i + 1]?.animations?.[0];
      if (clip) map.set(spec.name, clip);
    });
    return map;
  }, [gltfs, clips]);

  // Clone (SkeletonUtils handles skinned meshes) and bind the mixer to the
  // clone that actually renders.
  const renderObject = useMemo(
    () => (renderSource ? skeletonClone(renderSource) : null),
    [renderSource],
  );
  const mixer = useMemo(
    () => (renderObject ? new AnimationMixer(renderObject) : null),
    [renderObject],
  );
  const activeActionRef = useRef<AnimationAction | null>(null);
  const timeScaleRef = useRef(timeScale);
  useEffect(() => {
    timeScaleRef.current = timeScale;
  }, [timeScale]);

  // Crossfade to the active clip. No cleanup here: the outgoing action must
  // keep fading out while the new one fades in. Unmount stops everything.
  useEffect(() => {
    if (!mixer) return;
    const clip =
      (activeClip && clipMap.get(activeClip)) ||
      clipMap.values().next().value;
    if (!clip) return;
    const next = mixer.clipAction(clip);
    const prev = activeActionRef.current;
    if (prev === next) return;
    next.reset().fadeIn(CROSSFADE_SECONDS).play();
    if (prev) prev.fadeOut(CROSSFADE_SECONDS);
    activeActionRef.current = next;
  }, [mixer, clipMap, activeClip]);

  useEffect(() => {
    if (!mixer) return;
    return () => {
      mixer.stopAllAction();
      activeActionRef.current = null;
    };
  }, [mixer]);

  useFrame((_, delta) => {
    mixer?.update(delta * timeScaleRef.current);
  });

  if (!renderObject) return null;
  return (
    <primitive
      object={renderObject}
      scale={scale}
      rotation={rotation}
      position={position}
    />
  );
}

export default AnimatedModel;
