import Link from "next/link";

export default function AdminHomePage() {
  return (
    <section>
      <h2>Admin Overview</h2>
      <p>Operate users, roles, permissions, content sync, and governance controls.</p>
      <ul>
        <li><Link href="/admin/users">Users</Link></li>
        <li><Link href="/admin/roles">Roles</Link></li>
        <li><Link href="/admin/reports">Reports</Link></li>
        <li><Link href="/admin/permissions">Permissions</Link></li>
        <li><Link href="/admin/import-export">Import/Export</Link></li>
        <li><Link href="/admin/rules">Rules</Link></li>
        <li><Link href="/admin/audit">Audit</Link></li>
        <li><Link href="/admin/sync">Sync Center</Link></li>
      </ul>
    </section>
  );
}
