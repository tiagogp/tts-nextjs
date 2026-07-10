"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "@/features/correct/api";
import { MAX_CORRECTION_UPLOAD_BYTES } from "@/features/correct/constants";

interface UseCorrectionAudioOptions {
  onNote: (note: string | null) => void;
  onText: (updater: (current: string) => string) => void;
}

export function useCorrectionAudio({ onNote, onText }: UseCorrectionAudioOptions) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const transcribeBlob = useCallback(async (blob: Blob, filename?: string) => {
    setTranscribing(true);
    onNote(null);
    try {
      const text = await transcribeAudio(blob, filename);
      if (!text) {
        onNote("Couldn't make out any speech in that clip.");
        return;
      }
      onText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (err: unknown) {
      onNote(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }, [onNote, onText]);

  const startRecording = useCallback(async () => {
    onNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) void transcribeBlob(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      onNote("Couldn't access the microphone. Check the browser's permission.");
    }
  }, [onNote, transcribeBlob]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const onPickFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (file.size > MAX_CORRECTION_UPLOAD_BYTES) {
        onNote("Audio file too large (max 25 MB).");
        return;
      }
      void transcribeBlob(file, file.name);
    },
    [onNote, transcribeBlob],
  );

  return {
    fileInputRef,
    recording,
    transcribing,
    startRecording,
    stopRecording,
    onPickFile,
  };
}
