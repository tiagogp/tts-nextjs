"use client";

import { Segmented } from "@/components/ui/Segmented";
import { useT } from "@/i18n/I18nProvider";
import { SOURCE_KINDS } from "@/features/discover/constants";
import type { DiscoverSourceKind } from "@/features/discover/types";

interface SourcePickerProps {
  value: DiscoverSourceKind;
  onChange: (kind: DiscoverSourceKind) => void;
  disabled?: boolean;
}

export function SourcePicker({ value, onChange, disabled }: SourcePickerProps) {
  const { t } = useT();
  return (
    <Segmented<DiscoverSourceKind>
      label={t("Source type")}
      variant="fill"
      value={value}
      onChange={onChange}
      options={SOURCE_KINDS.map(({ kind, label }) => ({ value: kind, label: t(label), disabled }))}
    />
  );
}
