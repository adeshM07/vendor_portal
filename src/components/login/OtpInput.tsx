"use client";

import { useRef, type KeyboardEvent, type ClipboardEvent } from "react";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  variant?: "dark" | "light";
  onEnter?: () => void;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  compact = false,
  variant = "dark",
  onEnter,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").split("").slice(0, length);

  const updateValue = (index: number, digit: string) => {
    const chars = value.padEnd(length, " ").split("").slice(0, length);
    chars[index] = digit;
    const next = chars.join("").trimEnd();
    onChange(next.replace(/\s/g, ""));
  };

  const handleChange = (index: number, inputValue: string) => {
    const digit = inputValue.replace(/\D/g, "").slice(-1);
    if (!digit) return;
    updateValue(index, digit);
    if (index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]?.trim()) {
        updateValue(index, " ");
      } else if (index > 0) {
        updateValue(index - 1, " ");
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    } else if (e.key === "Enter" && onEnter && value.replace(/\s/g, "").length >= length) {
      e.preventDefault();
      onEnter();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  const boxClass =
    variant === "light"
      ? compact
        ? "h-10 w-9 rounded-md border border-gray-200 bg-gray-50 text-center text-base font-semibold text-gray-900 transition-all duration-200 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        : "h-12 w-11 rounded-lg border border-gray-200 bg-gray-50 text-center text-lg font-semibold text-gray-900 transition-all duration-200 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      : compact
        ? "h-10 w-9 rounded-md border border-zinc-800 bg-zinc-900/60 text-center text-base font-medium text-zinc-100 transition-all duration-200 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        : "h-12 w-11 rounded-lg border border-zinc-800 bg-zinc-900/60 text-center text-lg font-medium text-zinc-100 transition-all duration-200 outline-none placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className={`flex justify-center ${compact ? "gap-1.5" : "gap-2.5"}`}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[index]?.trim() || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          aria-label={`OTP digit ${index + 1}`}
          className={boxClass}
        />
      ))}
    </div>
  );
}
