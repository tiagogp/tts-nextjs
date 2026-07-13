"use client";

import { Chip } from "@/components/ui/Chip";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useT } from "@/i18n/I18nProvider";
import { errorTypeLabel } from "@/lib/cards/errorTypeLabels";
import { CORRECTION_ERROR_TYPES } from "@/features/correct/constants";
import type { CorrectionDraft } from "@/features/correct/types";
import type { ErrorType } from "@/lib/cards/schema";

interface ManualEntryFormProps {
  draft: CorrectionDraft;
  onChange: (patch: Partial<CorrectionDraft>) => void;
  onToggleType: (type: ErrorType) => void;
  onAdd: () => void;
}

export function ManualEntryForm({ draft, onChange, onToggleType, onAdd }: ManualEntryFormProps) {
  const { t } = useT();
  const canAdd = Boolean(draft.original.trim() && draft.corrected.trim());
  const optionalHint = <span className="font-normal lowercase opacity-70">— {t("optional")}</span>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("What you said")}>
          <Textarea
            value={draft.original}
            onChange={(event) => onChange({ original: event.target.value })}
            placeholder="I have 25 years"
            rows={2}
          />
        </Field>
        <Field label={t("Natural English version")}>
          <Textarea
            value={draft.corrected}
            onChange={(event) => onChange({ corrected: event.target.value })}
            placeholder="I'm 25 years old"
            rows={2}
          />
        </Field>
      </div>

      <Field label={<>{t("Error type")} {optionalHint}</>}>
        <div className="flex flex-wrap gap-1.5">
          {CORRECTION_ERROR_TYPES.map((type) => (
            <Chip key={type} active={draft.errorTypes.includes(type)} onClick={() => onToggleType(type)}>
              {t(errorTypeLabel(type))}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label={<>{t("Why it was wrong")} {optionalHint}</>}>
        <Input
          type="text"
          value={draft.rationale}
          onChange={(event) => onChange({ rationale: event.target.value })}
          placeholder={t("age uses 'be', not 'have'")}
        />
      </Field>

      <Chip active={canAdd} disabled={!canAdd} className="px-3 py-1.5" onClick={onAdd}>
        {t("+ Add to list")}
      </Chip>
    </div>
  );
}
