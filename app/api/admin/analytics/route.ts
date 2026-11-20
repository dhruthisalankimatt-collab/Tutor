import { getSession } from "@/lib/session";
import { Store } from "@/lib/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
  }

  const profile = Store.getProfile();
  const sessions = Store.getAllSessions();
  const analytics = Store.getAllAnalytics();
  const subjects = Store.getSubjects();

  return NextResponse.json({
    profile,
    sessions,
    analytics,
    subjects,
  });
}
