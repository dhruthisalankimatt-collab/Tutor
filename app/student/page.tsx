import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import StudentChat from "./student-chat";

export default async function StudentPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // Fetch student profile
  let profile = { grade: "10", board: "CBSE", school: "Narayana" };
  try {
    const { data } = await db.from("student_profiles").select("*").limit(1).maybeSingle();
    if (data) {
      profile = {
        grade: data.grade || "10",
        board: data.board || "CBSE",
        school: data.school || "Narayana",
      };
    }
  } catch {
    // Fallback
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StudentChat user={session} profile={profile} />
    </div>
  );
}
