'use client';

import { useTheme } from './theme-provider';
import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggle = () => {
    setIsAnimating(true);
    toggleTheme();
    setTimeout(() => setIsAnimating(false), 500);
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={handleToggle}
      className="relative group"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className={`
        relative w-14 h-8 rounded-full p-1
        transition-all duration-500 ease-spring
        ${isDark 
          ? 'bg-slate-800 shadow-inner shadow-black/50' 
          : 'bg-sky-200 shadow-inner shadow-sky-300/50'
        }
        group-hover:scale-105
        active:scale-95
      `}>
        {/* Track decorations */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Stars for dark mode */}
          <div className={`
            absolute top-1.5 left-2 transition-opacity duration-500
            ${isDark ? 'opacity-100' : 'opacity-0'}
          `}>
            <svg className="w-1 h-1 text-white/60" viewBox="0 0 4 4">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className={`
            absolute top-3 left-4 transition-opacity duration-500 delay-75
            ${isDark ? 'opacity-100' : 'opacity-0'}
          `}>
            <svg className="w-0.5 h-0.5 text-white/40" viewBox="0 0 4 4">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className={`
            absolute bottom-2 left-3 transition-opacity duration-500 delay-100
            ${isDark ? 'opacity-100' : 'opacity-0'}
          `}>
            <svg className="w-0.5 h-0.5 text-white/50" viewBox="0 0 4 4">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            </svg>
          </div>

          {/* Clouds for light mode */}
          <div className={`
            absolute top-2 right-3 transition-opacity duration-500
            ${!isDark ? 'opacity-100' : 'opacity-0'}
          `}>
            <svg className="w-3 h-2 text-white/60" viewBox="0 0 12 8">
              <path
                d="M2 6a2 2 0 0 1 2-2h.5A3.5 3.5 0 0 1 11 5a2 2 0 0 1-2 2H2z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        {/* Thumb */}
        <div className={`
          relative w-6 h-6 rounded-full
          transform transition-all duration-500 ease-spring
          ${isDark 
            ? 'translate-x-6 bg-gradient-to-br from-indigo-400 to-purple-500' 
            : 'translate-x-0 bg-gradient-to-br from-amber-300 to-orange-400'
          }
          ${isAnimating ? 'scale-90' : 'scale-100'}
          shadow-lg
        `}>
          {/* Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isDark ? (
              // Moon icon
              <svg 
                className={`
                  w-3.5 h-3.5 text-white transition-all duration-500
                  ${isAnimating ? 'rotate-12 scale-110' : 'rotate-0'}
                `} 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              // Sun icon
              <svg 
                className={`
                  w-3.5 h-3.5 text-white transition-all duration-500
                  ${isAnimating ? 'rotate-90 scale-110' : 'rotate-0'}
                `} 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>

          {/* Glow effect */}
          <div className={`
            absolute inset-0 rounded-full blur-sm transition-opacity duration-500
            ${isDark ? 'bg-purple-400/50' : 'bg-amber-300/50'}
            ${isAnimating ? 'opacity-100' : 'opacity-0'}
          `} />
        </div>
      </div>

      {/* Tooltip */}
      <span className="
        absolute -bottom-8 left-1/2 -translate-x-1/2
        text-[10px] font-medium uppercase tracking-wider
        text-[color:var(--muted)]
        opacity-0 group-hover:opacity-100
        transition-opacity duration-200
        whitespace-nowrap pointer-events-none
      ">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}

// Alternative compact version for navbars
export function ThemeToggleCompact() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative p-2.5 rounded-xl
        transition-all duration-300 ease-out
        ${isDark 
          ? 'bg-slate-800 hover:bg-slate-700 text-indigo-300' 
          : 'bg-amber-100 hover:bg-amber-200 text-amber-600'
        }
        hover:scale-110 active:scale-95
        group
      `}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative w-5 h-5">
        {/* Sun */}
        <svg 
          className={`
            absolute inset-0 w-5 h-5
            transition-all duration-500 ease-spring
            ${isDark 
              ? 'rotate-90 scale-0 opacity-0' 
              : 'rotate-0 scale-100 opacity-100'
            }
          `}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>

        {/* Moon */}
        <svg 
          className={`
            absolute inset-0 w-5 h-5
            transition-all duration-500 ease-spring
            ${isDark 
              ? 'rotate-0 scale-100 opacity-100' 
              : '-rotate-90 scale-0 opacity-0'
            }
          `}
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </div>

      {/* Subtle glow */}
      <div className={`
        absolute inset-0 rounded-xl blur-md -z-10
        transition-opacity duration-300
        ${isDark ? 'bg-indigo-500/30' : 'bg-amber-400/30'}
        opacity-0 group-hover:opacity-100
      `} />
    </button>
  );
}
