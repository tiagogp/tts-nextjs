"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { hoverLift, springSnappy, tapPress } from "@/lib/motion";
import {
  GRADES,
  GRADE_LABELS,
  previewInterval,
  Rating,
  type Grade,
  type SrsRecord,
} from "@/lib/srs/fsrs";
import { useT } from "@/i18n/I18nProvider";

/** Again→danger, Hard→warning, Good→success, Easy→info, all from design tokens. */
const GRADE_TONE: Record<Grade, string> = {
  [Rating.Again]: "border-danger text-danger",
  [Rating.Hard]: "border-warning text-warning",
  [Rating.Good]: "border-success text-success",
  [Rating.Easy]: "border-info text-info",
};

export function GradeButtons({ srs, onGrade }: { srs: SrsRecord; onGrade: (grade: Grade) => void }) {
  const { t } = useT();
  return (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map((grade) => (
        <motion.button
          key={grade}
          type="button"
          whileHover={hoverLift}
          whileTap={{ ...tapPress, y: 0 }}
          transition={springSnappy}
          onClick={() => onGrade(grade)}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-0.5 rounded border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            GRADE_TONE[grade],
          )}
        >
          <span>{t(GRADE_LABELS[grade])}</span>
          <span className="tabular-nums opacity-70">{previewInterval(srs, grade)}</span>
        </motion.button>
      ))}
    </div>
  );
}
