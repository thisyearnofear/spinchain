'use client';

import { useEffect } from 'react';
import { trackEvent, ANALYTICS_EVENTS } from '@/app/lib/analytics/events';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Track errors for analytics
    trackEvent(ANALYTICS_EVENTS.SESSION_PAUSED, {
      error: error.message,
      digest: error.digest,
      url: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    });
  }, [error]);

  return (
    <html>
      <body className="bg-gray-950 text-white">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-4xl">⚠️</span>
            </div>
            
            <h2 className="text-2xl font-bold mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-400 mb-6">
              We&apos;ve encountered an unexpected error. Your data is safe.
            </p>

            <div className="mb-6 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-left">
              <p className="text-xs font-mono text-red-400 break-all">
                {error.message}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => reset()}
                className="px-6 py-2.5 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 rounded-full border border-gray-700 text-gray-300 font-medium hover:border-gray-500 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
