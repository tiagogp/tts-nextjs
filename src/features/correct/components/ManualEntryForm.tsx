"use client";

import { Chip } from "@/components/ui/Chip";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ERROR_TYPES, type CorrectionDraft } from "@/features/correct/model";
import type { ErrorType } from "@/lib/cards/schema";

interface ManualEntryFormProps {
  draft: CorrectionDraft;
  onChange: (patch: Partial<CorrectionDraft>) => void;
  onToggleType: (type: ErrorType) => void;
  onAdd: () => void;
}

const optionalHint = <span className="font-normal lowercase opacity-70">— optional</span>;

export function ManualEntryForm({ draft, onChange, onToggleType, onAdd }: ManualEntryFormProps) {
  const canAdd = Boolean(draft.original.trim() && draft.corrected.trim());

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="What you said">
          <Textarea
            value={draft.original}
            onChange={(event) => onChange({ original: event.target.value })}
            placeholder="I have 25 years"
            rows={2}
          />
        </Field>
        <Field label="Native-correct version">
          <Textarea
            value={draft.corrected}
            onChange={(event) => onChange({ corrected: event.target.value })}
            placeholder="I'm 25 years old"
            rows={2}
          />
        </Field>
      </div>

      <Field label={<>Error type {optionalHint}</>}>
        <div className="flex flex-wrap gap-1.5">
          {ERROR_TYPES.map((type) => (
            <Chip key={type} active={draft.errorTypes.includes(type)} onClick={() => onToggleType(type)}>
              {type}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label={<>Why it was wrong {optionalHint}</>}>
        <Input
          type="text"
          value={draft.rationale}
          onChange={(event) => onChange({ rationale: event.target.value })}
          placeholder="age uses 'be', not 'have'"
        />
      </Field>

      <Chip active={canAdd} disabled={!canAdd} className="px-3 py-1.5" onClick={onAdd}>
        + Add to list
      </Chip>
    </div>
  );
}
