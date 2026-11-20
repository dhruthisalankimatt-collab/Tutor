import { db } from "../lib/db";
import { encrypt } from "../lib/crypto";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("-----------------------------------------");
  console.log("Seeding Smruthi's Tutor Platform Database");
  console.log("-----------------------------------------");

  // 1. Password Hashes
  const studentHash = await bcrypt.hash("studentinmyweb", 10);
  const adminHash = await bcrypt.hash("ibuiltthis", 10);

  // 2. Users (Smruthi & Dhruthi exclusively)
  console.log("Provisioning users: Smruthi (Student) & Dhruthi (Admin)...");
  const { data: users, error: userError } = await db.from("users").upsert([
    { username: "Smruthi", name: "Smruthi", password_hash: studentHash, role: "student" },
    { username: "Dhruthi", name: "Dhruthi", password_hash: adminHash, role: "admin" },
  ], { onConflict: "username" }).select();

  if (userError) {
    console.error("User provisioning error (ensure 001_schema.sql was run in Supabase):", userError);
  } else {
    console.log("Users provisioned successfully!");
  }

  // 3. Student Profile
  const smruthi = users?.find((u: any) => u.username.toLowerCase() === "smruthi");
  if (smruthi) {
    await db.from("student_profiles").upsert({
      user_id: smruthi.id,
      grade: "10",
      board: "CBSE",
      school: "Narayana",
    }, { onConflict: "user_id" });
    console.log("Student profile configured: Grade 10 CBSE, Narayana School.");
  }

  // 4. Default Subjects
  console.log("Configuring active subjects...");
  const defaultSubjects = ["Mathematics", "Science", "English", "Social Science", "Computer Science"];
  for (const s of defaultSubjects) {
    await db.from("subjects").upsert({ name: s, is_active: true }, { onConflict: "name" });
  }

  // 5. Encrypted AI Configurations
  console.log("Configuring AI Agents & encrypting keys at rest...");
  const agentKeys: Record<string, string | undefined> = {
    agent1: process.env.GROQ_API_KEY_AGENT1 || process.env.GROQ_API_KEY,
    agent2: process.env.GROQ_API_KEY_AGENT2 || process.env.GROQ_API_KEY,
    agent3: process.env.GROQ_API_KEY_AGENT3 || process.env.GROQ_API_KEY,
    vision: process.env.GROQ_API_KEY_VISION || process.env.GROQ_API_KEY,
  };

  const aiConfigs = [
    {
      agent_name: "agent1",
      model_name: "qwen/qwen3.8-27b",
      system_prompt:
        "You are a warm, encouraging Socratic tutor for Smruthi, Grade {{GRADE}}, {{BOARD}}. Subjects: {{SUBJECTS}}. Never reveal the final answer unless she explicitly gives up. Give one small progressive hint at a time. Guide her to solve the problem independently.",
      encrypted_api_key: agentKeys.agent1 ? encrypt(agentKeys.agent1) : null,
      temperature: 0.4,
      max_tokens: 1024,
    },
    {
      agent_name: "agent2",
      model_name: "qwen/qwen3.8-27b",
      system_prompt:
        "You analyse student Smruthi's recorded performance on one question. Grade {{GRADE}}, {{BOARD}}. Subjects: {{SUBJECTS}}. Classify question difficulty and type. Return JSON only.",
      encrypted_api_key: agentKeys.agent2 ? encrypt(agentKeys.agent2) : null,
      temperature: 0.2,
      max_tokens: 1024,
    },
    {
      agent_name: "agent3",
      model_name: "qwen/qwen3.8-27b",
      system_prompt:
        "You are the Prompt Configuration Manager. You update only the academic-context sections of tutor/analyst prompts.",
      encrypted_api_key: agentKeys.agent3 ? encrypt(agentKeys.agent3) : null,
      temperature: 0.3,
      max_tokens: 1024,
    },
    {
      agent_name: "vision",
      model_name: "qwen/qwen3.8-27b",
      system_prompt:
        "Transcribe the question exactly, preserving math notation, units, and describing essential diagrams.",
      encrypted_api_key: agentKeys.vision ? encrypt(agentKeys.vision) : null,
      temperature: 0.1,
      max_tokens: 1024,
    },
  ];

  for (const cfg of aiConfigs) {
    await db.from("ai_configurations").upsert(cfg, { onConflict: "agent_name" });
  }

  console.log("Database seed complete!");
}

seed().catch(console.error);
