"use client";

import { Chip } from "@/components/ui/Chip";
import { Textarea } from "@/components/ui/Field";

interface JsonImportFormProps {
  value: string;
  onChange: (value: string) => void;
  importNote: string | null;
  onImport: () => void;
}

const PLACEHOLDER = `Paste the correction tool's output, e.g.
[{ "original": "I have 25 years", "corrected": "I'm 25 years old", "errorTypes": ["collocation"], "rationale": "age uses 'be', not 'have'" }]`;

export function JsonImportForm({ value, onChange, importNote, onImport }: JsonImportFormProps) {
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={PLACEHOLDER}
        rows={7}
        className="px-4 py-3 font-mono leading-relaxed"
      />
      {importNote && <p className="text-xs text-danger">{importNote}</p>}
      <Chip active={Boolean(value.trim())} disabled={!value.trim()} className="px-3 py-1.5" onClick={onImport}>
        Import corrections
      </Chip>
    </div>
  );
}
