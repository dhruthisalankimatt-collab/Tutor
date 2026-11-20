import { db } from "@/lib/db";
import { createSessionToken, COOKIE_NAME } from "@/lib/session";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

// Fallback hardcoded credentials matching project specifications in case DB is not yet seeded
const CREDENTIALS = {
  smruthi: {
    username: "Smruthi",
    name: "Smruthi",
    passwordPlain: "studentinmyweb",
    role: "student" as const,
    defaultId: "11111111-1111-1111-1111-111111111111",
  },
  dhruthi: {
    username: "Dhruthi",
    name: "Dhruthi",
    passwordPlain: "ibuiltthis",
    role: "admin" as const,
    defaultId: "22222222-2222-2222-2222-222222222222",
  },
};

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password).trim();

    // Only two accounts allowed in this entire platform
    if (cleanUser !== "smruthi" && cleanUser !== "dhruthi") {
      return NextResponse.json(
        { error: "Invalid credentials. Only Smruthi and Dhruthi are permitted." },
        { status: 401 }
      );
    }

    // Try database lookup first
    let userRow: any = null;
    try {
      const { data } = await db
        .from("users")
        .select("*")
        .ilike("username", cleanUser)
        .maybeSingle();
      userRow = data;
    } catch (e) {
      console.warn("DB user lookup fallback:", e);
    }

    let passwordMatch = false;
    let uid = "";
    let role: "student" | "admin" = cleanUser === "dhruthi" ? "admin" : "student";
    let name = cleanUser === "dhruthi" ? "Dhruthi" : "Smruthi";

    if (userRow?.password_hash) {
      passwordMatch = await bcrypt.compare(cleanPass, userRow.password_hash);
      uid = userRow.id;
      role = userRow.role;
      name = userRow.name || name;
    }

    // Fallback if db table is empty or bcrypt check failed due to plain default password
    if (!passwordMatch) {
      const spec = CREDENTIALS[cleanUser as keyof typeof CREDENTIALS];
      if (cleanPass === spec.passwordPlain) {
        passwordMatch = true;
        uid = userRow?.id || spec.defaultId;
        role = spec.role;
        name = spec.name;

        // Auto-provision or update password hash in DB if possible
        try {
          const hash = await bcrypt.hash(cleanPass, 10);
          await db.from("users").upsert(
            { username: spec.username, name: spec.name, password_hash: hash, role: spec.role },
            { onConflict: "username" }
          );
        } catch {
          // Ignore
        }
      }
    }

    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      uid,
      role,
      username: name,
      name,
    });

    const response = NextResponse.json({
      success: true,
      role,
      name,
      redirect: role === "admin" ? "/admin" : "/student",
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: `Login error: ${err.message}` },
      { status: 500 }
    );
  }
}
