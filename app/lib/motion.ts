export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;
/** Strong ease-in-out for on-screen movement (matches globals.css --ease-in-out). */
export const EASE_MOVE: [number, number, number, number] = [0.77, 0, 0.175, 1];
export const EASE_EASE_OUT = "easeOut" as const;
export const EASE_EASE_IN_OUT = "easeInOut" as const;
export const EASE_SPRING_BOB = [0.34, 1.35, 0.64, 1] as const;

export const modalTransition = {
  duration: 0.25,
  ease: EASE_SMOOTH,
} as const;

export const modalExitTransition = {
  duration: 0.15,
  ease: EASE_SMOOTH,
} as const;

export const dropdownTransition = {
  duration: 0.25,
  ease: EASE_SMOOTH,
} as const;

export const dropdownExitTransition = {
  duration: 0.15,
  ease: EASE_SMOOTH,
} as const;

export const tooltipTransition = {
  duration: 0.15,
  ease: EASE_EASE_OUT,
} as const;

export const tooltipExitTransition = {
  duration: 0.05,
  ease: EASE_EASE_OUT,
} as const;

export const accordionTransition = {
  duration: 0.25,
  ease: EASE_SMOOTH,
} as const;

export const tabsTransition = {
  duration: 0.25,
  ease: EASE_SMOOTH,
} as const;

export const iconSwapTransition = {
  duration: 0.25,
  ease: EASE_EASE_IN_OUT,
} as const;

/** Button-press feedback budget: 100–160 ms. */
export const pressTransition = {
  duration: 0.16,
  ease: EASE_SMOOTH,
} as const;

/** Snappy spring for snaps/settles (drag release, chips). Bounce stays subtle. */
export const springSnappy = {
  type: "spring",
  duration: 0.4,
  bounce: 0.1,
} as const;

/** Soft spring for value-driven motion that must retarget mid-animation
 *  instead of restarting (intensity-linked scale/opacity). */
export const springSoft = {
  type: "spring",
  duration: 0.5,
  bounce: 0.2,
} as const;
