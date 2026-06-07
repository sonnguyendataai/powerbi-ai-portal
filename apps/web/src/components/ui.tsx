import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="sidebar-logo">
        <Link className="sidebar-logo-mark" href="/">
          <Image
            src="/brand/logodatamind.png"
            alt="DataMind"
            width={140}
            height={40}
            priority
            style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }}
          />
        </Link>
      </div>
    );
  }
  return (
    <Link href="/" style={{ display: "inline-flex", textDecoration: "none" }}>
      <Image
        src="/brand/logodatamind.png"
        alt="DataMind"
        width={180}
        height={52}
        priority
        style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }}
      />
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
      {props.actions ? <div style={{ flexShrink: 0 }}>{props.actions}</div> : null}
    </header>
  );
}

export function Surface(props: { title?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <section className="surface" style={props.style}>
      {props.title ? <div className="surface-title">{props.title}</div> : null}
      {props.children}
    </section>
  );
}

export function Stack(props: { children: ReactNode; gap?: number }) {
  return <div className="stack" style={props.gap !== undefined ? { gap: props.gap } : undefined}>{props.children}</div>;
}

export function Grid(props: { children: ReactNode; columns?: string; gap?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: props.columns ?? "1fr 1fr", gap: props.gap ?? 16 }}>
      {props.children}
    </div>
  );
}

export function MetricCard(props: { label: string; value: string; hint?: string; icon?: string }) {
  return (
    <article className="metric-card">
      <div className="metric-label">{props.label}</div>
      <div className="metric-value">{props.value}</div>
      {props.hint ? <div className="metric-hint">{props.hint}</div> : null}
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

export function Alert(props: { children: ReactNode; variant?: "error" | "success" | "info" }) {
  const cls = props.variant === "success" ? "alert success" : props.variant === "info" ? "alert info" : "alert";
  return <div className={cls}>{props.children}</div>;
}

export function Badge(props: { children: ReactNode; variant?: "default" | "success" | "warning" | "danger" }) {
  const cls = props.variant ? `badge ${props.variant}` : "badge";
  return <span className={cls}>{props.children}</span>;
}

export function Divider() {
  return <div className="divider" />;
}

export function Skeleton({ height = 16, width }: { height?: number; width?: number | string }) {
  return (
    <div
      style={{
        height,
        width: width ?? "100%",
        borderRadius: 6,
        background: "linear-gradient(90deg, rgba(108,142,247,0.06) 0%, rgba(108,142,247,0.12) 50%, rgba(108,142,247,0.06) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}
