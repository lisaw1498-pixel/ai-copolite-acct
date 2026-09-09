"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Voices don't expose a gender field, so this matches on the names browsers
// actually ship. Ordered best-sounding first: the "Natural"/"Online" voices
// are network-backed and markedly clearer than the older local ones.
const FEMALE_VOICE_PATTERNS = [
  /(aria|jenny|michelle|ava|emma|sonia|libby|clara|natasha).*(natural|online)/i,
  /(natural|online).*(aria|jenny|michelle|ava|emma|sonia|libby|clara|natasha)/i,
  /google (us|uk) english/i,
  /\b(samantha|karen|moira|tessa|fiona|serena|allison|susan|victoria)\b/i,
  /\b(zira|hazel|linda|heera|catherine)\b/i,
  /\bfemale\b/i,
];

// Names that are definitely male, so a generic fallback never lands on one
// when a female voice was asked for.
const MALE_VOICE_PATTERN =
  /\b(david|mark|george|guy|ryan|christopher|eric|brandon|daniel|alex|fred|james|paul|richard|thomas|william|oliver|liam|male)\b/i;

/**
 * Picks the clearest available female English voice.
 *
 * Falls back to any non-male English voice, then to whatever exists - a
 * robotic voice is still better than silence, and voice availability varies a
 * lot between machines and browsers.
 */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  if (english.length === 0) return voices[0] ?? null;

  for (const pattern of FEMALE_VOICE_PATTERNS) {
    const hit = english.find((v) => pattern.test(v.name) && !MALE_VOICE_PATTERN.test(v.name));
    if (hit) return hit;
  }
  const notMale = english.find((v) => !MALE_VOICE_PATTERN.test(v.name));
  if (notMale) return notMale;
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
        utterance.rate = opts.rate ?? 0.92;
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
