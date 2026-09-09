"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Picks the most natural-sounding English voice available.
 *
 * Browsers ship a mix of low-quality local voices and better network ones.
 * The network voices (Google, Microsoft Natural/Online) sound markedly more
 * like a person, which matters here - the point of hearing the question is to
 * practise under something closer to real conditions.
 */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  if (english.length === 0) return voices[0] ?? null;
  const preferred = [/natural/i, /google us english/i, /google uk english/i, /online/i, /aria|jenny|guy/i];
  for (const pattern of preferred) {
    const hit = english.find((v) => pattern.test(v.name));
    if (hit) return hit;
  }
  return english.find((v) => v.default) ?? english[0];
}

/**
 * Speaks interviewer questions aloud via the browser's built-in synthesizer -
 * free, no API key, same family as the recognition already in use.
 */
export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;
    setSupported(true);

    // getVoices() is populated asynchronously in Chrome; it returns an empty
    // array on first call until the engine has loaded.
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    };
  }, []);

  const cancel = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;
    window.speechSynthesis.cancel();
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    setSpeaking(false);
  }, []);

  /**
   * Speaks `text`, resolving when the utterance finishes. Resolves rather than
   * rejects on error so callers can always re-enable the microphone in a
   * `finally` - a swallowed rejection here would leave the mic muted for the
   * rest of the interview.
   */
  const speak = useCallback(
    (text: string, opts: { rate?: number } = {}) =>
      new Promise<void>((resolve) => {
        if (!isSpeechSynthesisSupported() || !text.trim()) return resolve();

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickVoice(window.speechSynthesis.getVoices());
        if (voice) utterance.voice = voice;
        // Slightly under default: interviewers don't rattle through questions,
        // and it gives the listener time to actually process what was asked.
        utterance.rate = opts.rate ?? 0.95;
        utterance.pitch = 1;

        const finish = () => {
          if (keepAliveRef.current) clearInterval(keepAliveRef.current);
          setSpeaking(false);
          resolve();
        };
        utterance.onend = finish;
        utterance.onerror = finish;

        setSpeaking(true);
        window.speechSynthesis.speak(utterance);

        // Chrome silently stops speaking after ~15 seconds unless nudged.
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        keepAliveRef.current = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            if (keepAliveRef.current) clearInterval(keepAliveRef.current);
            return;
          }
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }, 10000);
      }),
    []
  );

  return { speak, cancel, speaking, supported, voices };
}
