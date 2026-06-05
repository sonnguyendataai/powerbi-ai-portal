"use client";

import { useEffect, useState } from "react";
import { Alert, EmptyState, PageHeader, Surface } from "@/components/ui";

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

  useEffect(() => {
    void loadRules();
  }, []);

  return (
    <section>
      <PageHeader eyebrow="Governance" title="Rules" description="Review row-level and business filter rules used by portal permissions." actions={<button onClick={() => void loadRules()}>Refresh</button>} />
      {error ? <Alert>{error}</Alert> : null}
      <Surface>
        {rules.length === 0 ? <EmptyState title="No rules loaded" description="Refresh to inspect current rules." /> : null}
        <table className="table">
          <thead><tr><th>Name</th><th>Field</th><th>Values</th></tr></thead>
          <tbody>{rules.map((rule) => <tr key={rule.id}><td>{rule.name}</td><td>{rule.table}.{rule.column}</td><td>{rule.values.join(", ")}</td></tr>)}</tbody>
        </table>
      </Surface>
    </section>
  );
}
