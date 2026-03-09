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
      className={`relative rounded-3xl border border-white/10 bg-black/40 p-8 backdrop-blur-2xl shadow-2xl overflow-hidden group transition-all duration-500 hover:border-white/20 ${className}`}
    >
      {/* Subtle inner highlight */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

      {eyebrow ? (
        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[color:var(--muted)] mb-4">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h3
          className={`text-2xl font-black text-[color:var(--foreground)] tracking-tight ${eyebrow ? "" : "mt-0"}`}
        >
          {title}
        </h3>
      ) : null}
      {description ? (
        <p
          className={`text-sm text-[color:var(--muted)] leading-relaxed ${title ? "mt-3" : ""}`}
        >
          {description}
        </p>
      ) : null}
      <div className="relative z-10">{children}</div>
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
    <div className="relative rounded-2xl border border-white/10 bg-black/40 p-5 px-6 group transition-all duration-300 hover:border-white/20">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-[0.25em] font-black text-[color:var(--muted)]">
          {label}
        </p>
        <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--accent)] animate-pulse opacity-20 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-3xl font-black text-[color:var(--foreground)] tracking-tighter">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-[10px] font-bold text-[color:var(--muted)] uppercase tracking-tighter italic opacity-60 group-hover:opacity-100 transition-opacity">{detail}</p>
      ) : null}
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
  color?: "blue" | "indigo" | "amber" | "green";
  className?: string;
};

export function Tag({ children, color, className = "" }: TagProps) {
  const colorClasses = {
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]",
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
    green: "border-green-500/20 bg-green-500/5 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]",
  };

  const baseClass = color
    ? colorClasses[color]
    : "border-white/10 bg-white/5 text-white/50 shadow-sm";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] backdrop-blur-sm transition-all hover:scale-105 active:scale-95 ${baseClass} ${className}`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-20" />
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
      className={`relative rounded-3xl border border-white/10 bg-black/30 backdrop-blur-3xl shadow-2xl overflow-hidden ${className}`}
    >
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
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
