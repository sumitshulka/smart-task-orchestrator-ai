
import React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Form, FormLabel, FormControl, FormField, FormItem, FormMessage
} from "@/components/ui/form";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

type TaskReportFiltersProps = {
  fromDate: Date;
  toDate: Date;
  form: any;
};
export default function TaskReportFilters({ fromDate, toDate, form }: TaskReportFiltersProps) {
  return (
    <Form {...form}>
      <form className="flex flex-col md:flex-row gap-4 items-center w-full md:justify-start">
        <FormField
          control={form.control}
          name="fromDate"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>Start Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className="min-w-[140px] justify-start text-left font-normal"
                    >
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={date => date > toDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="toDate"
          render={({ field }: any) => (
            <FormItem>
              <FormLabel>End Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className="min-w-[140px] justify-start text-left font-normal"
                    >
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={date => date < fromDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
