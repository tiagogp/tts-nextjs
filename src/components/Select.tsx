"use client";

import * as RadixSelect from "@radix-ui/react-select";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
}

export default function Select({ value, onChange, options, disabled }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger
        className="w-full flex items-center justify-between px-3 py-2 text-sm outline-none transition-colors data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
        style={{
          backgroundColor: "var(--surface-input)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#ff5600")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 overflow-hidden text-sm"
          style={{
            backgroundColor: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            width: "var(--radix-select-trigger-width)",
          }}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="flex items-center px-3 py-2 rounded cursor-pointer outline-none select-none transition-colors"
                style={{ borderRadius: "4px", color: "var(--text-primary)" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: "#ff5600" }}>
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
