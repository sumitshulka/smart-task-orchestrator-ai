import React from "react";
import { addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, startOfDay, endOfDay } from "date-fns";

const presets = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "custom", label: "Custom" },
];

type DateRangePresetSelectorProps = {
  dateRange: { from: Date | null; to: Date | null };
  preset: string;
  onChange: (range: { from: Date | null; to: Date | null }, preset: string) => void;
};

// Ensure date ranges are always [00:00:00, 23:59:59.999]
function computeRange(key: string): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday":
      const yd = subDays(now, 1);
      return { from: startOfDay(yd), to: endOfDay(yd) };
    case "this_week":
      return { from: startOfDay(startOfWeek(now, { weekStartsOn: 1 })), to: endOfDay(endOfWeek(now, { weekStartsOn: 1 })) };
    case "last_week":
      const prevW = subWeeks(now, 1);
      return {
        from: startOfDay(startOfWeek(prevW, { weekStartsOn: 1 })),
        to: endOfDay(endOfWeek(prevW, { weekStartsOn: 1 })),
      };
    case "this_month":
      return { from: startOfDay(startOfMonth(now)), to: endOfDay(endOfMonth(now)) };
    case "last_month":
      const prevM = subMonths(now, 1);
      return { from: startOfDay(startOfMonth(prevM)), to: endOfDay(endOfMonth(prevM)) };
    default:
      // Custom, just pass-through
      return { from: null, to: null };
  }
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function DateRangePresetSelector({ dateRange, preset, onChange }: DateRangePresetSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {presets.map(opt => (
        <button
          key={opt.key}
          className={`px-2 py-1 rounded text-xs font-medium border 
            ${preset === opt.key ? "bg-primary text-white border-primary" : "bg-muted border-muted-foreground/20"}
            hover:bg-muted-foreground/10 transition`}
          type="button"
          onClick={() => {
            if (opt.key === "custom") {
              onChange(dateRange, "custom");
            } else {
              const range = computeRange(opt.key);
              onChange(range, opt.key);
            }
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
