type SectionProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: SectionProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[color:var(--foreground)] md:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      {children}
    </div>
  );
}

type CardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

export function SurfaceCard({
  eyebrow,
  title,
  description,
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 ${className}`}
    >
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h3 className={`text-lg font-semibold text-[color:var(--foreground)] ${eyebrow ? 'mt-3' : ''}`}>{title}</h3>
      ) : null}
      {description ? (
        <p className={`text-sm text-[color:var(--muted)] ${title ? 'mt-2' : ''}`}>{description}</p>
      ) : null}
      {children}
    </div>
  );
}

type MetricProps = {
  label: string;
  value: string;
  detail?: string;
};

export function MetricTile({ label, value, detail }: MetricProps) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{value}</p>
      {detail ? <p className="text-xs text-[color:var(--muted)]">{detail}</p> : null}
    </div>
  );
}

type BulletListProps = {
  items: string[];
};

export function BulletList({ items }: BulletListProps) {
  return (
    <ul className="space-y-3 text-sm text-[color:var(--foreground)]/80">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--accent)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

type TagProps = {
  children: React.ReactNode;
};

export function Tag({ children }: TagProps) {
  return (
    <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
      {children}
    </span>
  );
}

type ProgressRingProps = {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
  color?: string;
};

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  children,
  color = "var(--accent)",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        className="absolute inset-0 -rotate-90 transform"
        width={size}
        height={size}
      >
        <circle
          stroke="var(--surface-strong)"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  );
}

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]/50 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

type GradientTextProps = {
  children: React.ReactNode;
  className?: string;
};

export function GradientText({ children, className = "" }: GradientTextProps) {
  return (
    <span
      className={`bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-strong)] bg-clip-text text-transparent ${className}`}
    >
      {children}
    </span>
  );
}
