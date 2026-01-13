import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Calendar as CalendarIcon,
  Globe,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// --- Types ---
interface DateTimePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  nullable?: boolean;
  includeTime?: boolean;
  includeSeconds?: boolean;
  placeholder?: string;
  className?: string;
}

// --- Helpers ---
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function padZero(n: number, length = 2): string {
  return String(n).padStart(length, "0");
}

function parseDateTime(value: string | null): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  if (!value) return null;

  // Handle various datetime formats
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2})?:?(\d{2})?:?(\d{2})?/
  );

  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10) - 1,
      day: parseInt(match[3], 10),
      hour: match[4] ? parseInt(match[4], 10) : 0,
      minute: match[5] ? parseInt(match[5], 10) : 0,
      second: match[6] ? parseInt(match[6], 10) : 0,
    };
  }

  // Try date only
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    return {
      year: parseInt(dateMatch[1], 10),
      month: parseInt(dateMatch[2], 10) - 1,
      day: parseInt(dateMatch[3], 10),
      hour: 0,
      minute: 0,
      second: 0,
    };
  }

  return null;
}

function formatDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  includeTime: boolean,
  includeSeconds: boolean
): string {
  const datePart = `${year}-${padZero(month + 1)}-${padZero(day)}`;
  if (!includeTime) return datePart;

  const timePart = includeSeconds
    ? `${padZero(hour)}:${padZero(minute)}:${padZero(second)}`
    : `${padZero(hour)}:${padZero(minute)}:00`;

  return `${datePart} ${timePart}`;
}

// --- Scroll Wheel Number Input ---
interface ScrollNumberInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  padLength?: number;
}

function ScrollNumberInput({
  value,
  min,
  max,
  onChange,
  label,
  padLength = 2,
}: ScrollNumberInputProps) {
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      let newValue = value + delta;
      if (newValue > max) newValue = min;
      if (newValue < min) newValue = max;
      onChange(newValue);
    },
    [value, min, max, onChange]
  );

  const increment = () => {
    onChange(value >= max ? min : value + 1);
  };

  const decrement = () => {
    onChange(value <= min ? max : value - 1);
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] uppercase tracking-widest text-muted-foreground/60 font-medium">
        {label}
      </span>
      <div className="relative flex flex-col items-center">
        <button
          type="button"
          onClick={increment}
          className="h-5 w-10 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 rounded-t transition-colors"
        >
          <ChevronLeft className="h-3 w-3 rotate-90" />
        </button>
        <div
          onWheel={handleWheel}
          className="h-8 w-10 flex items-center justify-center bg-muted/40 border border-border/50 rounded font-mono text-sm font-semibold tabular-nums cursor-ns-resize select-none hover:bg-muted/60 transition-colors"
        >
          {padZero(value, padLength)}
        </div>
        <button
          type="button"
          onClick={decrement}
          className="h-5 w-10 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 rounded-b transition-colors"
        >
          <ChevronRight className="h-3 w-3 rotate-90" />
        </button>
      </div>
    </div>
  );
}

// --- Year Picker Grid ---
interface YearPickerProps {
  currentYear: number;
  selectedYear: number;
  onSelect: (year: number) => void;
  onClose: () => void;
}

function YearPicker({ currentYear, selectedYear, onSelect, onClose }: YearPickerProps) {
  const [decadeStart, setDecadeStart] = useState(() => Math.floor(currentYear / 10) * 10);

  const years = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i);
  }, [decadeStart]);

  const thisYear = new Date().getFullYear();

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setDecadeStart(decadeStart - 10)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-semibold text-muted-foreground">
          {decadeStart} — {decadeStart + 9}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setDecadeStart(decadeStart + 10)}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {years.map((year) => {
          const isSelected = year === selectedYear;
          const isCurrent = year === thisYear;
          const isOutOfRange = year < decadeStart || year > decadeStart + 9;

          return (
            <button
              key={year}
              type="button"
              onClick={() => {
                onSelect(year);
                onClose();
              }}
              className={cn(
                "h-9 rounded text-xs font-medium transition-all",
                isOutOfRange && "text-muted-foreground/40",
                !isOutOfRange && !isSelected && "hover:bg-muted/60",
                isSelected && "bg-primary text-primary-foreground shadow-sm",
                isCurrent && !isSelected && "ring-1 ring-primary/40"
              )}
            >
              {year}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Month Picker Grid ---
interface MonthPickerProps {
  selectedMonth: number;
  onSelect: (month: number) => void;
  onClose: () => void;
}

function MonthPicker({ selectedMonth, onSelect, onClose }: MonthPickerProps) {
  const currentMonth = new Date().getMonth();

  return (
    <div className="p-2">
      <div className="text-xs font-semibold text-muted-foreground text-center mb-2">
        Select Month
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS_SHORT.map((month, index) => {
          const isSelected = index === selectedMonth;
          const isCurrent = index === currentMonth;

          return (
            <button
              key={month}
              type="button"
              onClick={() => {
                onSelect(index);
                onClose();
              }}
              className={cn(
                "h-9 rounded text-xs font-medium transition-all",
                !isSelected && "hover:bg-muted/60",
                isSelected && "bg-primary text-primary-foreground shadow-sm",
                isCurrent && !isSelected && "ring-1 ring-primary/40"
              )}
            >
              {month}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Calendar Grid ---
interface CalendarGridProps {
  year: number;
  month: number;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
}

function CalendarGrid({ year, month, selectedDay, onSelectDay }: CalendarGridProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  // Build calendar grid
  const cells: Array<{ day: number; isCurrentMonth: boolean }> = [];

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, isCurrentMonth: true });
  }

  // Next month days (fill to 42 cells for 6 rows)
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, isCurrentMonth: false });
  }

  return (
    <div className="p-2">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="h-7 flex items-center justify-center text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, index) => {
          const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
          const isToday = isCurrentMonth && cell.isCurrentMonth && cell.day === todayDate;

          return (
            <button
              key={index}
              type="button"
              disabled={!cell.isCurrentMonth}
              onClick={() => cell.isCurrentMonth && onSelectDay(cell.day)}
              className={cn(
                "h-8 w-8 rounded-md text-xs font-medium transition-all flex items-center justify-center",
                !cell.isCurrentMonth && "text-muted-foreground/30 cursor-default",
                cell.isCurrentMonth && !isSelected && "hover:bg-muted/60",
                isSelected && "bg-primary text-primary-foreground shadow-sm",
                isToday && !isSelected && "ring-1 ring-inset ring-primary/50 text-primary font-bold"
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Main DateTimePicker Component ---
export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  nullable = true,
  includeTime = true,
  includeSeconds = true,
  placeholder,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"calendar" | "year" | "month">("calendar");

  // Parse initial value or use current date for picker state
  const parsed = useMemo(() => parseDateTime(value), [value]);
  const now = new Date();

  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(parsed?.day ?? null);
  const [hour, setHour] = useState(parsed?.hour ?? 0);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const [second, setSecond] = useState(parsed?.second ?? 0);

  // Sync state when value changes externally
  useEffect(() => {
    const p = parseDateTime(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelectedDay(p.day);
      setHour(p.hour);
      setMinute(p.minute);
      setSecond(p.second);
    } else {
      setSelectedDay(null);
    }
  }, [value]);

  // Update parent when selection changes
  const updateValue = useCallback(
    (day: number | null, h?: number, m?: number, s?: number) => {
      if (day === null) {
        if (nullable) onChange(null);
        return;
      }

      const formatted = formatDateTime(
        viewYear,
        viewMonth,
        day,
        h ?? hour,
        m ?? minute,
        s ?? second,
        includeTime,
        includeSeconds
      );
      onChange(formatted);
    },
    [viewYear, viewMonth, hour, minute, second, includeTime, includeSeconds, nullable, onChange]
  );

  const handleDaySelect = (day: number) => {
    setSelectedDay(day);
    updateValue(day);
  };

  const handleTimeChange = (type: "hour" | "minute" | "second", val: number) => {
    if (type === "hour") {
      setHour(val);
      if (selectedDay !== null) updateValue(selectedDay, val, minute, second);
    } else if (type === "minute") {
      setMinute(val);
      if (selectedDay !== null) updateValue(selectedDay, hour, val, second);
    } else {
      setSecond(val);
      if (selectedDay !== null) updateValue(selectedDay, hour, minute, val);
    }
  };

  const setNow = (utc = false) => {
    const now = new Date();
    const y = utc ? now.getUTCFullYear() : now.getFullYear();
    const mo = utc ? now.getUTCMonth() : now.getMonth();
    const d = utc ? now.getUTCDate() : now.getDate();
    const h = utc ? now.getUTCHours() : now.getHours();
    const mi = utc ? now.getUTCMinutes() : now.getMinutes();
    const s = utc ? now.getUTCSeconds() : now.getSeconds();

    setViewYear(y);
    setViewMonth(mo);
    setSelectedDay(d);
    setHour(h);
    setMinute(mi);
    setSecond(s);

    const formatted = formatDateTime(y, mo, d, h, mi, s, includeTime, includeSeconds);
    onChange(formatted);
  };

  const clear = () => {
    setSelectedDay(null);
    if (nullable) onChange(null);
  };

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  // Display value
  const displayValue = useMemo(() => {
    if (!value) return "";
    const p = parseDateTime(value);
    if (!p) return value;

    const dateStr = `${MONTHS_SHORT[p.month]} ${p.day}, ${p.year}`;
    if (!includeTime) return dateStr;

    const timeStr = includeSeconds
      ? `${padZero(p.hour)}:${padZero(p.minute)}:${padZero(p.second)}`
      : `${padZero(p.hour)}:${padZero(p.minute)}`;

    return `${dateStr} ${timeStr}`;
  }, [value, includeTime, includeSeconds]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 h-9 px-3 w-full rounded-md border border-input bg-background/50 text-sm font-mono transition-all",
            "hover:bg-background focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            disabled && "cursor-not-allowed opacity-50 bg-muted/50",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left truncate">
            {displayValue || placeholder || "Select date..."}
          </span>
          {value && nullable && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 bg-popover border shadow-xl"
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={16}
        avoidCollisions={true}
      >
        <div className="min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/20">
            {view === "calendar" ? (
              <>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewYear(viewYear - 1)}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={goToPrevMonth}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setView("month")}
                    className="px-2 py-1 rounded text-sm font-semibold hover:bg-muted/60 transition-colors"
                  >
                    {MONTHS[viewMonth]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("year")}
                    className="px-2 py-1 rounded text-sm font-semibold hover:bg-muted/60 transition-colors"
                  >
                    {viewYear}
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={goToNextMonth}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewYear(viewYear + 1)}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setView("calendar")}
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Back
                </Button>
                <span className="text-xs font-semibold text-muted-foreground">
                  {view === "year" ? "Select Year" : "Select Month"}
                </span>
                <div className="w-16" />
              </div>
            )}
          </div>

          {/* Content */}
          {view === "calendar" && (
            <CalendarGrid
              year={viewYear}
              month={viewMonth}
              selectedDay={selectedDay}
              onSelectDay={handleDaySelect}
            />
          )}

          {view === "year" && (
            <YearPicker
              currentYear={viewYear}
              selectedYear={viewYear}
              onSelect={setViewYear}
              onClose={() => setView("calendar")}
            />
          )}

          {view === "month" && (
            <MonthPicker
              selectedMonth={viewMonth}
              onSelect={setViewMonth}
              onClose={() => setView("calendar")}
            />
          )}

          {/* Time picker */}
          {includeTime && view === "calendar" && (
            <div className="px-3 py-3 border-t border-border/50 bg-muted/10">
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground mr-2" />
                <ScrollNumberInput
                  value={hour}
                  min={0}
                  max={23}
                  onChange={(v) => handleTimeChange("hour", v)}
                  label="Hour"
                />
                <span className="text-lg font-bold text-muted-foreground/40 mx-0.5">:</span>
                <ScrollNumberInput
                  value={minute}
                  min={0}
                  max={59}
                  onChange={(v) => handleTimeChange("minute", v)}
                  label="Min"
                />
                {includeSeconds && (
                  <>
                    <span className="text-lg font-bold text-muted-foreground/40 mx-0.5">:</span>
                    <ScrollNumberInput
                      value={second}
                      min={0}
                      max={59}
                      onChange={(v) => handleTimeChange("second", v)}
                      label="Sec"
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex items-center gap-1 px-2 py-2 border-t border-border/50 bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] gap-1.5 flex-1"
              onClick={goToToday}
            >
              <CalendarIcon className="h-3 w-3" />
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] gap-1.5 flex-1"
              onClick={() => setNow(false)}
            >
              <Clock className="h-3 w-3" />
              Now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] gap-1.5 flex-1"
              onClick={() => setNow(true)}
            >
              <Globe className="h-3 w-3" />
              UTC
            </Button>
            {nullable && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={clear}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- Date Only Picker (convenience wrapper) ---
export function DatePicker(props: Omit<DateTimePickerProps, "includeTime" | "includeSeconds">) {
  return <DateTimePicker {...props} includeTime={false} includeSeconds={false} />;
}

// --- Time Only Picker ---
interface TimePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  nullable?: boolean;
  includeSeconds?: boolean;
  placeholder?: string;
  className?: string;
}

export function TimePicker({
  value,
  onChange,
  disabled = false,
  nullable = true,
  includeSeconds = true,
  placeholder,
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse time value (HH:MM:SS or HH:MM)
  const parsed = useMemo(() => {
    if (!value) return null;
    const match = value.match(/^(\d{2}):(\d{2}):?(\d{2})?$/);
    if (match) {
      return {
        hour: parseInt(match[1], 10),
        minute: parseInt(match[2], 10),
        second: match[3] ? parseInt(match[3], 10) : 0,
      };
    }
    return null;
  }, [value]);

  const [hour, setHour] = useState(parsed?.hour ?? 0);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const [second, setSecond] = useState(parsed?.second ?? 0);

  useEffect(() => {
    if (parsed) {
      setHour(parsed.hour);
      setMinute(parsed.minute);
      setSecond(parsed.second);
    }
  }, [parsed]);

  const formatTime = (h: number, m: number, s: number) => {
    return includeSeconds
      ? `${padZero(h)}:${padZero(m)}:${padZero(s)}`
      : `${padZero(h)}:${padZero(m)}`;
  };

  const handleChange = (type: "hour" | "minute" | "second", val: number) => {
    let h = hour, m = minute, s = second;
    if (type === "hour") { h = val; setHour(val); }
    if (type === "minute") { m = val; setMinute(val); }
    if (type === "second") { s = val; setSecond(val); }
    onChange(formatTime(h, m, s));
  };

  const setNow = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    setHour(h);
    setMinute(m);
    setSecond(s);
    onChange(formatTime(h, m, s));
  };

  const clear = () => {
    if (nullable) onChange(null);
  };

  const displayValue = value || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 h-9 px-3 w-full rounded-md border border-input bg-background/50 text-sm font-mono transition-all",
            "hover:bg-background focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            disabled && "cursor-not-allowed opacity-50 bg-muted/50",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">
            {displayValue || placeholder || "Select time..."}
          </span>
          {value && nullable && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-4 bg-popover border shadow-xl"
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={16}
        avoidCollisions={true}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-1">
            <ScrollNumberInput
              value={hour}
              min={0}
              max={23}
              onChange={(v) => handleChange("hour", v)}
              label="Hour"
            />
            <span className="text-lg font-bold text-muted-foreground/40 mx-0.5">:</span>
            <ScrollNumberInput
              value={minute}
              min={0}
              max={59}
              onChange={(v) => handleChange("minute", v)}
              label="Min"
            />
            {includeSeconds && (
              <>
                <span className="text-lg font-bold text-muted-foreground/40 mx-0.5">:</span>
                <ScrollNumberInput
                  value={second}
                  min={0}
                  max={59}
                  onChange={(v) => handleChange("second", v)}
                  label="Sec"
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] gap-1.5"
              onClick={setNow}
            >
              <Clock className="h-3 w-3" />
              Now
            </Button>
            {nullable && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                onClick={clear}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
