export type AnswerStatus = "YES" | "NO" | "SKIP";
export type AnswerValue = AnswerStatus | "";

export type Category = "coding" | "career" | "health" | "ai";

export interface Activity {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: Category;
  sort_order: number;
  is_active: boolean;
}

export interface SavedResponse {
  activity_id: number;
  activity_slug: string;
  activity_name: string;
  category: Category;
  status: AnswerStatus;
  note: string;
}

export interface DailySummary {
  completed: number;
  not_completed: number;
  skipped: number;
  completion_rate: number | null;
}

export interface CheckIn {
  id: number;
  date: string;
  responses: SavedResponse[];
  summary: DailySummary;
}

export interface CheckInResult {
  date: string;
  checkin: CheckIn | null;
}

export interface CalendarDay {
  date: string;
  has_checkin: boolean;
  completed: number;
  not_completed: number;
  skipped: number;
  completion_rate: number | null;
  level: number;
}

export interface ActivityCalendarDay {
  date: string;
  has_checkin: boolean;
  has_response: boolean;
  status: AnswerStatus | null;
  note: string;
  level: number;
}

export interface ActivityStats {
  activity_id: number;
  slug: string;
  name: string;
  category: Category;
  current_streak: number;
  longest_streak: number;
  latest_streak: number;
  latest_streak_end: string | null;
  latest_streak_is_active: boolean;
  total_completed_days: number;
  last_completed_date: string | null;
  completion_rate: number | null;
}

export interface StreakSummary {
  current_active_streak: number;
  best_individual_activity_streak: number;
  total_completed_activity_days: number;
  overall_completion_rate: number | null;
  activities: ActivityStats[];
  timezone: string;
}

export interface LoginUser {
  id: number;
  username: string;
}
