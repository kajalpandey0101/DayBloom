import { useMemo } from "react";
import type { CalendarDay } from "../types";

interface Props<T extends CalendarDay> {
  days: T[];
  selectedDate?: string;
  onSelect: (day: T) => void;
  compact?: boolean;
}

export default function Heatmap<T extends CalendarDay>({ days, selectedDate, onSelect, compact = false }: Props<T>) {
  const offset = days.length
    ? new Date(`${days[0].date}T12:00:00`).getDay()
    : 0;
  const weekCount = Math.max(1, Math.ceil((offset + days.length) / 7));
  const monthLabels = useMemo(() => {
    const labels = new Map<number, string>();
    days.forEach((day, index) => {
      const date = new Date(`${day.date}T12:00:00`);
      if (index === 0 || date.getDate() === 1) {
        const week = Math.floor((offset + index) / 7);
        if (!labels.has(week)) {
          labels.set(week, date.toLocaleDateString("en-IN", { month: "short" }));
        }
      }
    });
    return Array.from(labels, ([week, label]) => ({ week, label }));
  }, [days, offset]);

  return (
    <div className={`heatmap-wrap ${compact ? "heatmap-compact" : ""}`}>
      <div className="weekday-labels" aria-hidden="true">
        <span>Sun</span><span></span><span>Tue</span><span></span><span>Thu</span><span></span><span>Sat</span>
      </div>
      <div
        className="heatmap-grid"
        role="group"
        aria-label={`${days.length}-day activity calendar`}
        style={{ gridTemplateColumns: `repeat(${weekCount}, var(--heatmap-cell))` }}
      >
        {monthLabels.map(({ week, label }) => (
          <span className="month-label" key={`${week}-${label}`} style={{ gridColumn: week + 1, gridRow: 1 }}>{label}</span>
        ))}
        {days.map((day, index) => {
          const date = new Date(`${day.date}T12:00:00`);
          const column = Math.floor((offset + index) / 7) + 1;
          const row = (date.getDay() + 2);
          const title = day.has_checkin
            ? `${day.completed} completed · ${day.not_completed} not completed · ${day.skipped} skipped · ${day.date}`
            : `No check-in recorded · ${day.date}`;
          return (
            <button
              key={day.date}
              className={`heatmap-cell level-${day.level} ${selectedDate === day.date ? "selected" : ""}`}
              style={{ gridColumn: column, gridRow: row }}
              title={title}
              aria-label={title}
              aria-pressed={selectedDate === day.date}
              onClick={() => onSelect(day)}
            />
          );
        })}
      </div>
    </div>
  );
}
