"use client";

import { Segmented } from "@/components/ui/Segmented";
import { SOURCE_KINDS } from "@/features/discover/constants";
import type { DiscoverSourceKind } from "@/features/discover/types";

interface SourcePickerProps {
  value: DiscoverSourceKind;
  onChange: (kind: DiscoverSourceKind) => void;
  disabled?: boolean;
}

export function SourcePicker({ value, onChange, disabled }: SourcePickerProps) {
  return (
    <Segmented<DiscoverSourceKind>
      label="Tipo de fonte"
      variant="fill"
      value={value}
      onChange={onChange}
      options={SOURCE_KINDS.map(({ kind, label }) => ({ value: kind, label, disabled }))}
    />
  );
}
