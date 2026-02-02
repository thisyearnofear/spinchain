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
        <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      {children}
    </div>
  );
}

type CardProps = {
  eyebrow?: string;
  title: string;
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
      className={`rounded-2xl border border-white/10 bg-[color:var(--surface)] p-6 ${className}`}
    >
      {eyebrow ? (
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
      {description ? (
        <p className="mt-2 text-sm text-[color:var(--muted)]">{description}</p>
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
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {detail ? <p className="text-xs text-white/60">{detail}</p> : null}
    </div>
  );
}

type BulletListProps = {
  items: string[];
};

export function BulletList({ items }: BulletListProps) {
  return (
    <ul className="space-y-3 text-sm text-white/80">
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
    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
      {children}
    </span>
  );
}
