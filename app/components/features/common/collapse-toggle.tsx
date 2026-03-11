"use client";

/**
 * CollapseToggle - Reusable chevron toggle for collapsible panels
 *
 * Core Principles:
 * - DRY: Single component for all panel collapse toggles
 * - CLEAN: Presentation-only, state managed by parent
 * - PERFORMANT: CSS transitions, no JS animations
 *
 * Usage:
 *   <CollapseToggle
 *     isCollapsed={state.workoutPlan}
 *     onToggle={() => toggle('workoutPlan')}
 *     label="Workout Plan"
 *   />
 */

import { memo } from 'react';

export interface CollapseToggleProps {
  /** Whether the panel is currently collapsed */
  isCollapsed: boolean;
  /** Callback when toggle is clicked */
  onToggle: () => void;
  /** Accessible label for the toggle button */
  label: string;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

function CollapseToggleInternal({
  isCollapsed,
  onToggle,
  label,
  className = '',
  size = 'sm',
}: CollapseToggleProps) {
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const buttonSize = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${buttonSize} rounded-md text-white/50 hover:text-white/80 hover:bg-white/10 transition-all active:scale-95 ${className}`}
      aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
      aria-expanded={!isCollapsed}
      aria-controls={`${label.toLowerCase().replace(/\s+/g, '-')}-panel`}
    >
      <svg
        className={`${iconSize} transition-transform duration-200 ${
          isCollapsed ? '-rotate-90' : 'rotate-0'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
}

export const CollapseToggle = memo(CollapseToggleInternal);
