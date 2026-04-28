import { norm } from "@/lib/categories";

export const isGymStore = (storeCategory?: string | null) =>
  !!storeCategory && norm(storeCategory) === norm("Academia");

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export type GymPlan = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: string;
  highlight: string | null;
  features: string[];
  position: number;
  is_active: boolean;
};

export type GymClass = {
  id: string;
  store_id: string;
  name: string;
  instructor: string | null;
  weekday: number;
  starts_at: string; // HH:MM:SS
  ends_at: string;
  capacity: number | null;
  description: string | null;
  is_active: boolean;
  position: number;
};

export type GymMember = {
  id: string;
  store_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  plan_id: string | null;
  notes: string | null;
  is_active: boolean;
  joined_at: string;
};

export type GymWorkout = {
  id: string;
  store_id: string;
  member_id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
};

export type GymWorkoutExercise = {
  id: string;
  workout_id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number | null;
  notes: string | null;
  position: number;
};

export const formatTime = (t: string) => t.slice(0, 5);
