"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal ambient typings for the Web Speech API (not in default TS DOM libs).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Wraps the browser's built-in (free, no API key) speech recognition for
 * continuous, streaming transcription - used by both Mock Interview and the
 * Live Interview Copilot. Chrome/Edge only; callers should check
 * isSpeechRecognitionSupported() and offer Manual Question Mode otherwise.
 */
export function useSpeechRecognition(onChunk: (text: string, isFinal: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) onChunkRef.current(final.trim(), true);
      else if (interim) onChunkRef.current(interim.trim(), false);
    };
    recognition.onerror = () => {
      // Swallow transient errors (no-speech, network); onend will restart if still listening.
    };
    recognition.onend = () => {
      // Auto-restart for continuous listening unless deliberately stopped.
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // ignore
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    setListening(false);
    recognition?.stop();
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop, listening, supported };
}
