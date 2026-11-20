import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Store } from "@/lib/store";
import AdminDashboardClient from "./admin-dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/login");
  }

  // Load from Store (combining Supabase + persistent file store)
  const profile = Store.getProfile();
  const sessions = Store.getAllSessions();
  const analytics = Store.getAllAnalytics();
  const subjects = Store.getSubjects();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AdminDashboardClient
        user={session}
        profile={profile}
        sessions={sessions}
        analytics={analytics}
        subjects={subjects}
      />
    </div>
  );
}
