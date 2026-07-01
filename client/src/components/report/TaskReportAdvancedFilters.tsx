
import React from "react";
import { format } from "date-fns";
import { CalendarIcon, Search, X, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import DateRangePresetSelector from "@/components/DateRangePresetSelector";
import { useDepartments } from "@/hooks/useDepartments";
import { apiClient } from "@/lib/api";

type User = {
  id: string;
  user_name: string | null;
  email: string;
  department: string | null;
};

interface CfField {
  id: string;
  field_key: string;
  field_type: string;
  label: string;
  module: string;
  is_reportable: boolean;
  options: { value: string; label: string }[] | null;
}

type TaskReportAdvancedFiltersProps = {
  dateRange: { from: Date | null; to: Date | null };
  setDateRange: (range: { from: Date | null; to: Date | null }) => void;
  departmentFilter: string;
  setDepartmentFilter: (dept: string) => void;
  alphabetFilter: string;
  setAlphabetFilter: (letter: string) => void;
  selectedEmployees: User[];
  setSelectedEmployees: (employees: User[]) => void;
  allUsers: User[];
  isAdmin: boolean;
  cfFilters?: Record<string, string>;
  setCfFilters?: (filters: Record<string, string>) => void;
};

export default function TaskReportAdvancedFilters({
  dateRange,
  setDateRange,
  departmentFilter,
  setDepartmentFilter,
  alphabetFilter,
  setAlphabetFilter,
  selectedEmployees,
  setSelectedEmployees,
  allUsers,
  isAdmin,
  cfFilters = {},
  setCfFilters,
}: TaskReportAdvancedFiltersProps) {
  const [preset, setPreset] = React.useState<string>("custom");
  const [employeeSearchOpen, setEmployeeSearchOpen] = React.useState(false);
  const { departments, loading: depsLoading } = useDepartments();

  // Fetch reportable CF fields for the task module
  const { data: cfFieldsRaw = [] } = useQuery<CfField[]>({
    queryKey: ["/api/custom-fields/definitions", "task", "reportable"],
    queryFn: async () => {
      const res = await apiClient.get("/custom-fields/definitions?module=task");
      return Array.isArray(res) ? res : res?.definitions ?? [];
    },
  });

  const reportableFields = React.useMemo(
    () => cfFieldsRaw.filter((f: CfField) => f.is_reportable && f.field_type !== "user_reference"),
    [cfFieldsRaw],
  );

  function handlePresetChange(range: { from: Date | null; to: Date | null }, p: string) {
    setPreset(p);
    if (p === "custom") return;
    setDateRange(range);
  }

  function handleCustomRange(range: { from: Date | null; to: Date | null }) {
    setPreset("custom");
    setDateRange(range);
  }

  const label = dateRange.from && dateRange.to
    ? `${format(dateRange.from, "LLL d, y")} - ${format(dateRange.to, "LLL d, y")}`
    : "Select range";

  const alphabetLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  const addEmployee = (user: User) => {
    if (!selectedEmployees.find(emp => emp.id === user.id)) {
      setSelectedEmployees([...selectedEmployees, user]);
    }
    setEmployeeSearchOpen(false);
  };

  const removeEmployee = (userId: string) => {
    setSelectedEmployees(selectedEmployees.filter(emp => emp.id !== userId));
  };

  const clearAllFilters = () => {
    setDepartmentFilter("all");
    setAlphabetFilter("all");
    setSelectedEmployees([]);
  };

  function setCfFilter(fieldId: string, value: string) {
    if (!setCfFilters) return;
    setCfFilters({ ...cfFilters, [fieldId]: value });
  }

  const activeCfFilterCount = Object.values(cfFilters).filter(v => v.trim() !== "").length;

  return (
    <div className="space-y-4 w-full">
      {/* Date Range */}
      <div>
        <span className="block font-medium mb-1">Date Range</span>
        <DateRangePresetSelector
          dateRange={dateRange}
          preset={preset}
          onChange={handlePresetChange}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[220px] justify-start text-left font-normal mt-2">
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

      {/* Admin-only filters */}
      {isAdmin && (
        <>
          {/* Department Filter */}
          <div>
            <span className="block font-medium mb-1">Department</span>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {depsLoading ? (
                  <SelectItem value="" disabled>Loading...</SelectItem>
                ) : (
                  departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Alphabetic Filter */}
          <div>
            <span className="block font-medium mb-1">First Name Filter</span>
            <div className="flex flex-wrap gap-1">
              <Button
                variant={alphabetFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setAlphabetFilter("all")}
              >
                All
              </Button>
              {alphabetLetters.map(letter => (
                <Button
                  key={letter}
                  variant={alphabetFilter === letter ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => setAlphabetFilter(letter)}
                >
                  {letter}
                </Button>
              ))}
            </div>
          </div>

          {/* Employee Multi-Search */}
          <div>
            <span className="block font-medium mb-1">Specific Employees</span>
            <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Search className="mr-2 h-4 w-4" />
                  Search employees...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search employees..." />
                  <CommandList>
                    <CommandEmpty>No employees found.</CommandEmpty>
                    <CommandGroup>
                      {allUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => addEmployee(user)}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col">
                            <span>{user.user_name || user.email}</span>
                            <span className="text-xs text-muted-foreground">
                              {user.email} {user.department && `• ${user.department}`}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Selected employees */}
            {selectedEmployees.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedEmployees.map((employee) => (
                  <Badge key={employee.id} variant="secondary" className="flex items-center gap-1">
                    {employee.user_name || employee.email}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeEmployee(employee.id)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Clear Filters */}
          {(departmentFilter !== "all" || alphabetFilter !== "all" || selectedEmployees.length > 0) && (
            <Button variant="outline" onClick={clearAllFilters} className="w-full">
              Clear All Filters
            </Button>
          )}
        </>
      )}

      {/* Custom Field Filters — shown when reportable task CFs exist */}
      {reportableFields.length > 0 && setCfFilters && (
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-500" />
              Custom Field Filters
              {activeCfFilterCount > 0 && (
                <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200 ml-1">
                  {activeCfFilterCount} active
                </Badge>
              )}
            </span>
            {activeCfFilterCount > 0 && (
              <button
                className="text-xs text-gray-400 hover:text-gray-600 underline"
                onClick={() => setCfFilters({})}
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-2">
            {reportableFields.map(f => (
              <div key={f.id}>
                <Label className="text-xs text-gray-500 mb-1 block">{f.label}</Label>
                {(f.field_type === "select" || f.field_type === "multiselect") && f.options?.length ? (
                  <select
                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
                    value={cfFilters[f.id] ?? ""}
                    onChange={e => setCfFilter(f.id, e.target.value)}
                  >
                    <option value="">Any</option>
                    {f.options.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.field_type === "boolean" ? (
                  <select
                    className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
                    value={cfFilters[f.id] ?? ""}
                    onChange={e => setCfFilter(f.id, e.target.value)}
                  >
                    <option value="">Any</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <Input
                    className="h-8 text-sm"
                    placeholder={
                      f.field_type === "date" || f.field_type === "datetime"
                        ? "YYYY-MM-DD"
                        : `Filter by ${f.label}…`
                    }
                    value={cfFilters[f.id] ?? ""}
                    onChange={e => setCfFilter(f.id, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
