import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "tutor_store.json");

interface SessionRecord {
  id: string;
  student_id?: string;
  question_text: string;
  ocr_text?: string;
  image_url?: string;
  subject: string;
  topic?: string;
  question_type?: string;
  difficulty?: string;
  correct_answer?: string;
  status: "In Progress" | "Solved" | "Given Up" | "Processing";
  started_at: string;
  completed_at?: string;
  total_time_seconds: number;
  hints_count: number;
  incorrect_attempts: number;
}

interface AnalyticsRecord {
  session_id: string;
  subject: string;
  topic: string;
  question_type: string;
  difficulty: string;
  hints_used: number;
  incorrect_attempts: number;
  time_spent: number;
  final_status: string;
  conceptual_score: number;
  problem_solving_score: number;
  formula_application_score: number;
  numerical_accuracy_score: number;
  mistake_categories: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  analytical_summary: string;
  analyzed_at: string;
}

interface ChatRecord {
  session_id: string;
  sender: "student" | "tutor";
  message: string;
  image_url?: string;
  message_type: string;
  created_at: string;
}

interface AppStore {
  sessions: Record<string, SessionRecord>;
  analytics: Record<string, AnalyticsRecord>;
  chat: ChatRecord[];
  profile: {
    name: string;
    grade: string;
    board: string;
    school: string;
  };
  subjects: Array<{ name: string; is_active: boolean }>;
}

const defaultStore: AppStore = {
  sessions: {},
  analytics: {},
  chat: [],
  profile: {
    name: "Smruthi",
    grade: "10",
    board: "CBSE",
    school: "Narayana",
  },
  subjects: [
    { name: "Mathematics", is_active: true },
    { name: "Science", is_active: true },
    { name: "English", is_active: true },
    { name: "Social Science", is_active: true },
    { name: "Computer Science", is_active: true },
  ],
};

function readStore(): AppStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      return { ...defaultStore, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn("[readStore] Failed to read local store file:", err);
  }
  return { ...defaultStore };
}

function writeStore(store: AppStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("[writeStore] Failed to write local store file:", err);
  }
}

export const Store = {
  getStore(): AppStore {
    return readStore();
  },

  getSession(id: string): SessionRecord | undefined {
    const store = readStore();
    return store.sessions[id];
  },

  getAllSessions(): SessionRecord[] {
    const store = readStore();
    return Object.values(store.sessions).sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );
  },

  getAllAnalytics(): AnalyticsRecord[] {
    const store = readStore();
    return Object.values(store.analytics).sort(
      (a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime()
    );
  },

  getChatMessages(sessionId: string): ChatRecord[] {
    const store = readStore();
    return store.chat.filter((c) => c.session_id === sessionId);
  },

  saveSession(session: SessionRecord) {
    const store = readStore();
    store.sessions[session.id] = {
      ...(store.sessions[session.id] || {}),
      ...session,
    };
    writeStore(store);

    // Also attempt async write to Supabase if available
    Promise.resolve(
      db.from("question_sessions").upsert({
        id: session.id,
        question_text: session.question_text,
        subject: session.subject,
        topic: session.topic,
        question_type: session.question_type,
        difficulty: session.difficulty,
        correct_answer: session.correct_answer,
        status: session.status,
        started_at: session.started_at,
        completed_at: session.completed_at,
        total_time_seconds: session.total_time_seconds,
      }, { onConflict: "id" })
    ).catch(() => {});
  },

  saveAnalytics(an: AnalyticsRecord) {
    const store = readStore();
    store.analytics[an.session_id] = {
      ...(store.analytics[an.session_id] || {}),
      ...an,
    };
    writeStore(store);

    // Also attempt async write to Supabase
    Promise.resolve(
      db.from("question_analytics").upsert(an, { onConflict: "session_id" })
    ).catch(() => {});
  },

  addChatMessage(chat: ChatRecord) {
    const store = readStore();
    store.chat.push(chat);
    writeStore(store);

    // Also attempt async write to Supabase
    Promise.resolve(
      db.from("chat_messages").insert([
        {
          session_id: chat.session_id,
          sender: chat.sender,
          message: chat.message,
          message_type: chat.message_type,
        },
      ])
    ).catch(() => {});
  },

  resetStudentHistory() {
    const store = readStore();
    store.sessions = {};
    store.analytics = {};
    store.chat = [];
    writeStore(store);
  },

  updateProfile(profile: { name: string; grade: string; board: string; school: string }) {
    const store = readStore();
    store.profile = profile;
    writeStore(store);
  },

  getProfile() {
    const store = readStore();
    return store.profile;
  },

  updateSubjects(subjects: Array<{ name: string; is_active: boolean }>) {
    const store = readStore();
    store.subjects = subjects;
    writeStore(store);
  },

  getSubjects() {
    const store = readStore();
    return store.subjects;
  },
};
