export function CyclingSpinner({ className = '' }: { className?: string }) {
    return (
        <div className={`inline-flex items-center justify-center ${className}`}>
            <svg
                className="animate-spin"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Bike wheel with spokes */}
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="4 4"
                    opacity="0.3"
                />
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="15 45"
                    opacity="0.8"
                />
                {/* Center hub */}
                <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
        </div>
    );
}
