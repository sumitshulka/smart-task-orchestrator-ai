
import React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";

type TaskReportFiltersProps = {
  dateRange: { from: Date | null; to: Date | null };
  setDateRange: (range: { from: Date | null; to: Date | null }) => void;
};

export default function TaskReportFilters({ dateRange, setDateRange }: TaskReportFiltersProps) {
  const [preset, setPreset] = React.useState<string>("custom");

  function handlePresetChange(range: { from: Date | null; to: Date | null }, p: string) {
    setPreset(p);
    if (p === "custom") return; // allow calendar
    setDateRange(range);
  }
  function handleCustomRange(range: { from: Date | null; to: Date | null }) {
    setPreset("custom");
    setDateRange(range);
  }

  const label =
    dateRange.from && dateRange.to
      ? `${format(dateRange.from, "LLL d, y")} - ${format(dateRange.to, "LLL d, y")}`
      : "Select range";

  return (
    <div className="flex flex-col gap-2 w-full">
      <div>
        <span className="block font-medium mb-1">Date Range</span>
        <DateRangePresetSelector
          dateRange={dateRange}
          preset={preset}
          onChange={handlePresetChange}
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[220px] justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
            <span>{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleCustomRange}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
