"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SliderProps = {
  className?: string;
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number[]) => void;
};

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  onValueChange,
}: SliderProps) {
  const initial = Array.isArray(defaultValue) ? (defaultValue[0] ?? min) : min;
  const [innerValue, setInnerValue] = React.useState(initial);
  const current = Array.isArray(value) ? (value[0] ?? min) : innerValue;
  const ratio = ((current - min) / (max - min || 1)) * 100;

  return (
    <div className={cn("relative w-full py-2", className)} data-slot="slider">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
      <div
        className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
        style={{ width: `${Math.min(Math.max(ratio, 0), 100)}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Array.isArray(value)) {
            setInnerValue(next);
          }
          onValueChange?.([next]);
        }}
        className={cn(
          "relative z-10 h-6 w-full appearance-none bg-transparent",
          "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent",
          "[&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ring [&::-webkit-slider-thumb]:bg-white",
          "[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
          "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ring [&::-moz-range-thumb]:bg-white",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      />
    </div>
  );
}

export { Slider };
