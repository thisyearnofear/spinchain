export const EASE_SMOOTH = [0.22, 1, 0.36, 1] as const;
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
