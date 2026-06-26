import type { DailyTask } from "./schema";
import type { CalendarDay, DayStatus } from "./types";

export function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

export function getIsoWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function getPlanDayStatus(
  planDay: DailyTask | null,
  date: string,
  today: string,
): DayStatus {
  if (!planDay) return "empty";
  if (date === today) return "today";
  const done = planDay.tasks.filter((task) => task.completedAt != null).length;
  if (done === planDay.tasks.length) return "completed";
  if (date < today) return done > 0 ? "partial" : "missed";
  if (done > 0) return "partial";
  return "upcoming";
}

export function buildCalendarDays(
  year: number,
  month: number,
  planDaysByDate: Map<string, DailyTask>,
  today: string,
): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: CalendarDay[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrev - i);
    const ds = dateString(date);
    const planDay = planDaysByDate.get(ds) ?? null;
    cells.push({
      date: ds,
      dayOfMonth: daysInPrev - i,
      inCurrentMonth: false,
      status: getPlanDayStatus(planDay, ds, today),
      planDay,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const ds = dateString(date);
    const planDay = planDaysByDate.get(ds) ?? null;
    cells.push({
      date: ds,
      dayOfMonth: day,
      inCurrentMonth: true,
      status: getPlanDayStatus(planDay, ds, today),
      planDay,
    });
  }

  const remainder = cells.length % 7;
  if (remainder > 0) {
    for (let day = 1; day <= 7 - remainder; day++) {
      const date = new Date(year, month + 1, day);
      const ds = dateString(date);
      const planDay = planDaysByDate.get(ds) ?? null;
      cells.push({
        date: ds,
        dayOfMonth: day,
        inCurrentMonth: false,
        status: getPlanDayStatus(planDay, ds, today),
        planDay,
      });
    }
  }

  return cells;
}
