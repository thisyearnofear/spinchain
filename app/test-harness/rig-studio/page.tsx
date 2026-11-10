"use client";

import nextDynamic from "next/dynamic";

/**
 * Rig studio — the rider + bike rig in isolation under studio lighting with
 * a fixed camera, so bike fit (saddle contact, reach, foot-on-pedal, crank
 * phase) can be inspected at a granular level and compared frame-for-frame.
 *
 *   ?avatar=meshy-rider      registered avatar id
 *   ?view=side|front|back|iso|rear34|top|pedal|bars
 *   ?phase=0.8               crank phase (rad); omit to animate at 80rpm
 *   ?t=1.2                   frozen clip time (s); omit to play
 *   ?markers=1               draw rig anchors (axles, BB, hoods, solved hip)
 *   ?nobike=1                hide the bike (rider only)
 *   ?debug=1                 log the solved fit to the console
 */
export const dynamic = "force-dynamic";

const Studio = nextDynamic(() => import("./rig-studio-client").then((m) => m.RigStudioClient), {
  ssr: false,
});

export default function RigStudioPage() {
  return <Studio />;
}
