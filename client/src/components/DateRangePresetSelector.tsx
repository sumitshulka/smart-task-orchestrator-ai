// Fix: Remove local startOfDay/endOfDay and use date-fns version

import React from "react";
import {
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  startOfDay,
  endOfDay,
} from "date-fns";

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

// Fix: today/yesterday preset correctly returns [00:00:00, 23:59:59.999]
function computeRange(key: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (key) {
    case "today": {
      const from = startOfDay(now);
      const to = endOfDay(now);
      return { from, to };
    }
    case "yesterday": {
      const yd = subDays(now, 1);
      const from = startOfDay(yd);
      const to = endOfDay(yd);
      return { from, to };
    }
    case "this_week":
      return {
        from: startOfDay(startOfWeek(now, { weekStartsOn: 1 })),
        to: endOfDay(endOfWeek(now, { weekStartsOn: 1 })),
      };
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
      return {
        from: startOfDay(startOfMonth(prevM)),
        to: endOfDay(endOfMonth(prevM)),
      };
    default:
      // Custom, just pass-through
      return { from: null, to: null };
  }
}

export default function DateRangePresetSelector({
  dateRange,
  preset,
  onChange,
}: DateRangePresetSelectorProps) {
  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map((opt) => (
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

      {/* Custom date picker - visible when custom is selected */}
      {preset === "custom" && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="text-sm font-medium mb-3">Select Custom Date Range</h4>
          <div className="flex gap-4 items-center flex-wrap">
            {/* From Date Input */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                value={dateRange.from ? dateRange.from.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const newDate = e.target.value ? new Date(e.target.value) : null;
                  onChange({ from: newDate, to: dateRange.to }, "custom");
                }}
                className="px-3 py-1 border rounded text-sm"
              />
            </div>

            {/* To Date Input */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                value={dateRange.to ? dateRange.to.toISOString().split('T')[0] : ''}
                onChange={(e) => {
                  const newDate = e.target.value ? new Date(e.target.value) : null;
                  onChange({ from: dateRange.from, to: newDate }, "custom");
                }}
                min={dateRange.from ? dateRange.from.toISOString().split('T')[0] : undefined}
                className="px-3 py-1 border rounded text-sm"
              />
            </div>
            
            {/* Selected range display */}
            {dateRange.from && dateRange.to && (
              <div className="text-xs text-green-600 font-medium">
                {`${dateRange.from.toLocaleDateString()} - ${dateRange.to.toLocaleDateString()}`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
