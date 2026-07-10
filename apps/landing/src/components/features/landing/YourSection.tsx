import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { listItem, staggerContainer } from "@/lib/motion";
import {
  translateLanding,
  type LandingLanguage,
} from "@landing/lib/landingLanguage";

const steps = [
  ["Descobrir", "Encontre uma frase em uma fonte real."],
  ["Guardar", "Salve a linha que vale lembrar."],
  ["Revisar", "Crie um card com contexto e áudio."],
  ["Reforçar", "Pratique de novo quando ela virar um ponto fraco."],
];

export function YourSection({ language }: { language: LandingLanguage }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number }[]
  >([]);

  useEffect(() => {
    const updateLines = () => {
      const container = containerRef.current;

      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      const nextLines = itemRefs.current
        .slice(0, -1)
        .map((item, index) => {
          const nextItem = itemRefs.current[index + 1];

          if (!item || !nextItem) return null;

          const currentRect = item.getBoundingClientRect();
          const nextRect = nextItem.getBoundingClientRect();

          return {
            x1: currentRect.right - containerRect.left,
            y1: currentRect.top + currentRect.height / 2 - containerRect.top,
            x2: nextRect.left - containerRect.left,
            y2: nextRect.top + nextRect.height / 2 - containerRect.top,
          };
        })
        .filter(Boolean) as {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }[];

      setLines(nextLines);
    };

    updateLines();

    window.addEventListener("resize", updateLines);

    const observer = new ResizeObserver(updateLines);

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    itemRefs.current.forEach((item) => {
      if (item) observer.observe(item);
    });

    return () => {
      window.removeEventListener("resize", updateLines);
      observer.disconnect();
    };
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className="relative mt-6 grid gap-3 md:grid-cols-4"
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
      >
        {lines.map((line, index) => (
          <line
            key={index}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            className="stroke-accent/70"
            strokeWidth="1"
          />
        ))}
      </svg>

      {steps.map(([label, body], index) => (
        <motion.div
          key={label}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          className="relative z-10 min-h-32 rounded border border-line bg-card p-4"
          variants={listItem}
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="h-px flex-1 bg-line" />
          </div>

          <p className="brand-wordmark text-2xl font-normal leading-none text-ink">
            {translateLanding(language, label)}
          </p>

          <p className="mt-1 text-sm leading-6 text-ink-muted">
            {translateLanding(language, body)}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
