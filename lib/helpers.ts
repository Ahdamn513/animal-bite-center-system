export const TZ = "Asia/Manila";
export const SLOT_CAPACITY = 5;
export const DOSE_DAYS = [0, 3, 7, 28];
export const SLOT_TIMES = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
];

export type Role = "patient" | "staff" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  contact: string | null;
  role: Role;
};

export type Appointment = {
  id: string;
  patient_id: string | null;
  walk_in_name: string | null;
  slot_time: string;
  queue_number: number | null;
  status: "booked" | "arrived" | "called" | "done" | "cancelled";
  arrived_at: string | null;
  called_at: string | null;
  finished_at: string | null;
  profiles?: { full_name: string | null } | null;
};

export type Dose = {
  id: string;
  patient_id: string;
  dose_number: number;
  scheduled_date: string;
  given_at: string | null;
  profiles?: { full_name: string | null } | null;
};

/** Today's date in the Philippines as YYYY-MM-DD. */
export function todayManila(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Build a timestamp for a Manila date and time, e.g. 2026-10-22 and 08:30. */
export function slotISO(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDate(date: string): string {
  return new Date(`${date}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function minutesBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00+08:00`).getTime();
  const b = new Date(`${to}T00:00:00+08:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function doseState(
  dose: Dose,
  today: string
): "given" | "due" | "upcoming" | "missed" {
  if (dose.given_at) return "given";
  if (dose.scheduled_date === today) return "due";
  if (dose.scheduled_date < today) return "missed";
  return "upcoming";
}

export function patientName(a: Appointment): string {
  return a.walk_in_name ?? a.profiles?.full_name ?? "Unnamed patient";
}
