import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand-logo" href="/">
      <Image
        src="/brand/datamind-logo.png"
        alt="DataMind"
        width={compact ? 140 : 220}
        height={compact ? 50 : 78}
        priority
      />
      {compact ? null : (
        <span className="brand-wordmark">
          <span className="brand-name">Power BI AI Portal</span>
          <span className="brand-tagline">Enterprise analytics operations</span>
        </span>
      )}
    </Link>
  );
}

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {props.eyebrow ? <div className="eyebrow">{props.eyebrow}</div> : null}
        <h1 className="page-title">{props.title}</h1>
        {props.description ? <p className="page-description">{props.description}</p> : null}
      </div>
      {props.actions ? <div>{props.actions}</div> : null}
    </header>
  );
}

export function Surface(props: { title?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        background: "rgba(15,23,48,0.7)",
        ...props.style,
      }}
    >
      {props.title ? <h3 style={{ marginTop: 0 }}>{props.title}</h3> : null}
      {props.children}
    </section>
  );
}

export function Stack(props: { children: ReactNode; gap?: number }) {
  return <div className="stack" style={{ gap: props.gap }}>{props.children}</div>;
}

export function Grid(props: { children: ReactNode; columns?: string; gap?: number }) {
  return <div style={{ display: "grid", gridTemplateColumns: props.columns ?? "1fr 1fr", gap: props.gap ?? 12 }}>{props.children}</div>;
}

export function MetricCard(props: { label: string; value: string; hint?: string }) {
  return (
    <article className="metric-card">
      <div className="muted">{props.label}</div>
      <div className="metric-value">{props.value}</div>
      {props.hint ? <div className="muted">{props.hint}</div> : null}
    </article>
  );
}

export function EmptyState(props: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{props.title}</h3>
      <p>{props.description}</p>
      {props.action}
    </div>
  );
}

export function Alert(props: { children: ReactNode }) {
  return <div className="alert">{props.children}</div>;
}
