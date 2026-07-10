import type { Metadata } from "next";
import LandingClient from "./landing/LandingClient";

export const metadata: Metadata = {
  title: "PhraseLoop - Local-first English practice",
  description:
    "Turn real English into audio-backed flashcards, practice sessions, and focused drills - locally by default.",
};

export default function Home() {
  return <LandingClient />;
}
