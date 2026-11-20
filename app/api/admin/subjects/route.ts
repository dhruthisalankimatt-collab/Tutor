import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [{ data: profile }, { data: subjects }] = await Promise.all([
      db.from("student_profiles").select("*").limit(1).maybeSingle(),
      db.from("subjects").select("*").order("name"),
    ]);

    return NextResponse.json({
      profile: profile || { grade: "10", board: "CBSE", school: "Narayana" },
      subjects: subjects || [
        { name: "Mathematics", is_active: true },
        { name: "Science", is_active: true },
        { name: "English", is_active: true },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { profile, subjects } = await req.json();

    // 1. Update student profile
    const { data: existingProfile } = await db.from("student_profiles").select("*").limit(1).maybeSingle();
    if (existingProfile) {
      await db.from("student_profiles").update({
        grade: profile.grade,
        board: profile.board,
        school: profile.school,
        updated_at: new Date().toISOString(),
      }).eq("id", existingProfile.id);
    } else {
      await db.from("student_profiles").insert({
        grade: profile.grade,
        board: profile.board,
        school: profile.school,
      });
    }

    // 2. Sync subjects
    if (Array.isArray(subjects)) {
      for (const subj of subjects) {
        if (subj.name?.trim()) {
          await db.from("subjects").upsert(
            { name: subj.name.trim(), is_active: subj.is_active ?? true },
            { onConflict: "name" }
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
