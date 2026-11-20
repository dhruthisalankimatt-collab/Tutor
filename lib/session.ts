import { cookies } from "next/headers";
import * as jose from "jose";

export interface SessionUser {
  uid: string;
  role: "student" | "admin";
  username: string;
  name: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "smruthi-tutor-secure-jwt-secret-key-32chars";
const COOKIE_NAME = "tutor_session";

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);

    return {
      uid: (payload.uid as string) || (payload.sub as string),
      role: payload.role as "student" | "admin",
      username: payload.username as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new jose.SignJWT({
    uid: user.uid,
    role: user.role,
    username: user.username,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export { COOKIE_NAME };
