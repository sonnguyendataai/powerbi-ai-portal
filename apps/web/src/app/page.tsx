import { redirect } from "next/navigation";
import { getServerSessionPayload } from "@/session-server";

export default async function HomePage() {
  const session = await getServerSessionPayload();
  if (!session) {
    redirect("/login");
  }
  redirect(`/t/${session.tenantId}/dashboard`);
}
