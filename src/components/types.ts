import type { Student } from "@/lib/engine/types";
import type { Recommendations } from "@/lib/careers";

export interface TranscriptRow {
  code: string;
  title: string;
  grade?: string;
  term?: string;
  transferFrom?: string;
  status: "completed" | "in-progress";
  known: boolean;
  keep?: boolean;
}

export interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Text sent to the API when it differs from what the thread shows */
  raw?: string;
  kind?: "text" | "survey" | "transcript" | "typing" | "recs";
  recs?: Recommendations;
  chips?: string[];
  attach?: string;
  rows?: TranscriptRow[];
  warnings?: string[];
  done?: boolean;
  notice?: string;
}

export interface StudentState {
  student: Student;
  programs: string[];
  messages: Msg[];
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/** The parts of the profile the client may change in its planning sandbox. */
export const patchOf = (s: Student) => ({
  survey: s.survey,
  preferences: s.preferences,
  completed: s.completed,
  inProgress: s.inProgress,
  targetGradTerm: s.targetGradTerm,
});
