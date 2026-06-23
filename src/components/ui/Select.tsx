"use client";

import * as RadixSelect from "@radix-ui/react-select";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export default function Select({ value, onChange, options, disabled }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger
        className="flex w-full items-center justify-between rounded border border-line bg-input px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent data-disabled:cursor-not-allowed data-disabled:opacity-50"
      >
        <RadixSelect.Value />
        <RadixSelect.Icon>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="shrink-0 text-ink-muted"
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 w-(--radix-select-trigger-width) overflow-hidden rounded-md border border-line bg-card text-sm shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          <RadixSelect.Viewport className="p-1 max-h-64 overflow-y-auto">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="flex cursor-pointer select-none items-center rounded px-3 py-2 text-ink outline-none transition-colors data-highlighted:bg-surface"
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-accent">
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
