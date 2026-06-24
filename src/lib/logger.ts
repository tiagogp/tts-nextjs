import pino from "pino";

export const logger = pino({
  name: "phraseloop",
  level: process.env.LOG_LEVEL || "info",
});
