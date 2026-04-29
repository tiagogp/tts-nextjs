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
        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded outline-none transition-colors data-disabled:opacity-50 data-disabled:cursor-not-allowed bg-(--surface-input) text-(--text-primary) border border-(--border) focus:border-(--accent)"
      >
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0 text-(--text-muted)"
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 overflow-hidden text-sm rounded-md bg-(--surface-card) border border-(--border) shadow-[0_4px_16px_rgba(0,0,0,0.12)] w-(--radix-select-trigger-width)"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="flex items-center px-3 py-2 rounded cursor-pointer outline-none select-none transition-colors text-(--text-primary) data-highlighted:bg-(--surface)"
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-(--accent)">
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
