import type { CSSProperties, ReactNode } from "react";

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
  return <div style={{ display: "grid", gap: props.gap ?? 10 }}>{props.children}</div>;
}

export function Grid(props: { children: ReactNode; columns?: string; gap?: number }) {
  return <div style={{ display: "grid", gridTemplateColumns: props.columns ?? "1fr 1fr", gap: props.gap ?? 12 }}>{props.children}</div>;
}
