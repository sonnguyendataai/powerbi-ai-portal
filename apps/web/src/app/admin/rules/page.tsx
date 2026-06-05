"use client";

import { useState } from "react";

interface RuleItem {
  id: string;
  name: string;
  table: string;
  column: string;
  values: string[];
}

export default function AdminRulesPage() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [error, setError] = useState("");

  async function loadRules(): Promise<void> {
    const res = await fetch("/api/admin/rules");
    const json = (await res.json()) as { rules?: RuleItem[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load rules");
      return;
    }
    setError("");
    setRules(json.rules ?? []);
  }

  return (
    <section>
      <h2>Rules</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => void loadRules()}>Load</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <ul>
        {rules.map((rule) => (
          <li key={rule.id}>{rule.name} · {rule.table}.{rule.column} = {rule.values.join(",")}</li>
        ))}
      </ul>
    </section>
  );
}
