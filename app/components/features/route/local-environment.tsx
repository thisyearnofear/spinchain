"use client";

import { Environment, Lightformer } from "@react-three/drei";

interface LocalEnvironmentProps {
  sky: string;
  horizon: string;
  ground: string;
}

/**
 * Image-based lighting built in-scene from the theme's own colors. drei's
 * `<Environment preset>` downloads an .hdr from a third-party CDN inside the
 * canvas Suspense boundary, so a blocked or slow fetch left the ride on
 * "Loading 3D route…". This renders a small cube map once from lightformers,
 * with no network, and reflections pick up the world's palette.
 */
export function LocalEnvironment({ sky, horizon, ground }: LocalEnvironmentProps) {
  return (
    <Environment resolution={64} frames={1}>
      <Lightformer form="rect" color={sky} intensity={1.2} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="ring" color={horizon} intensity={2} position={[0, 1, -12]} scale={[14, 4, 1]} />
      <Lightformer form="rect" color={horizon} intensity={0.8} position={[-12, 2, 0]} rotation-y={Math.PI / 2} scale={[20, 4, 1]} />
      <Lightformer form="rect" color={horizon} intensity={0.8} position={[12, 2, 0]} rotation-y={-Math.PI / 2} scale={[20, 4, 1]} />
      <Lightformer form="rect" color={ground} intensity={0.4} position={[0, -10, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
    </Environment>
  );
}
