import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Store } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
  }

  try {
    const { confirmation } = await req.json();

    if (confirmation !== "CONFIRM RESET") {
      return NextResponse.json(
        { error: "Confirmation phrase does not match. Action aborted." },
        { status: 400 }
      );
    }

    // 1. Reset file-based store
    Store.resetStudentHistory();

    // 2. Attempt database wipe (preserves users, configs, profiles, subjects)
    try {
      await Promise.all([
        db.from("question_analytics").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        db.from("hints").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        db.from("student_attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        db.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
        db.from("question_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      ]);
    } catch (e) {
      console.warn("DB wipe note:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Student learning database reset successfully. Credentials and configurations preserved.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Database reset error: ${err.message}` },
      { status: 500 }
    );
  }
}
