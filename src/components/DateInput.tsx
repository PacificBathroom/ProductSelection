// src/components/DateInput.tsx
import React from "react";

type Props = {
  label?: string;
  value?: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  required?: boolean;
  id?: string;
};

export default function DateInput({
  label = "Presentation date",
  value,
  onChange,
  required,
  id,
}: Props) {
  const inputId = id ?? "date-input";
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="border rounded px-3 py-2 outline-none focus:ring w-full"
        aria-label={label}
      />
    </div>
  );
}
