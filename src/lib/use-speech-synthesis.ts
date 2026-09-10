"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Where the chosen voice is remembered between sessions. */
const VOICE_PREF_KEY = "interviewerVoice";

// The neural voices. Edge exposes these ("Microsoft Aria Online (Natural) -
// English (United States)") and they sound like a person; the older local SAPI
// voices in the same list sound like a machine reading a list. Worth a
// dedicated tier because the difference is not subtle.
const NATURAL_HINT = /(natural|online|neural)/i;

// Voices carry no gender field, so this matches the names browsers ship.
// US-only on purpose: the previous list included Sonia and Libby (British),
// Natasha (Australian), Moira (Irish) and Heera (Indian), and whichever the
// browser happened to list first is the one that spoke.
const US_FEMALE_NAMES = /\b(aria|jenny|michelle|ava|emma|ana|nova|samantha|allison|susan|victoria|zira|linda)\b/i;

const MALE_VOICE_PATTERN =
  /\b(david|mark|george|guy|ryan|christopher|eric|brandon|daniel|alex|fred|james|paul|richard|thomas|william|oliver|liam|andrew|brian|roger|steffan|male)\b/i;

const isUS = (v: SpeechSynthesisVoice) => v.lang?.toLowerCase().startsWith("en-us");
const isEnglish = (v: SpeechSynthesisVoice) => v.lang?.toLowerCase().startsWith("en");

/**
 * English voices, American ones first, best-sounding first within that.
 *
 * Used both to pick a default and to populate the chooser, so the order the
 * candidate sees is the order of quality.
 */
export function rankVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (isUS(v)) s += 100;
    else if (isEnglish(v)) s += 40;
    if (NATURAL_HINT.test(v.name)) s += 20;
    if (US_FEMALE_NAMES.test(v.name)) s += 10;
    if (MALE_VOICE_PATTERN.test(v.name)) s -= 50;
    return s;
  };
  return voices.filter(isEnglish).sort((a, b) => score(b) - score(a));
}

/**
 * Picks the clearest American English voice available.
 *
 * A saved choice always wins - the candidate has heard the options and this
 * one is theirs. Otherwise American voices are preferred over every other
 * accent, and a natural/neural voice over a local one.
 */
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  preferredUri?: string | null
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  if (preferredUri) {
    const saved = voices.find((v) => v.voiceURI === preferredUri);
    if (saved) return saved;
  }
  return rankVoices(voices)[0] ?? voices[0] ?? null;
}

/**
 * Breaks text into pieces short enough to speak in one utterance.
 *
 * Chrome stops speaking after roughly 15 seconds of a single utterance. The
 * usual workaround is to call pause() and resume() on a timer, but that
 * interrupts the synthesizer mid-word and is audible as a stutter - it was the
 * reason questions came out choppy. Queueing several short utterances instead
 * never hits the limit and never interrupts anything.
 *
 * Splits on sentence ends so each pause lands where a speaker would breathe.
 *
 * 140 characters is roughly eleven seconds at this rate, which leaves real
 * headroom under the limit. Sitting close to it risks the cutoff on exactly
 * the long question where being cut off matters most.
 */
export function chunkForSpeech(text: string, maxChars = 140): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxChars) {
      chunks.push(current.trim());
      current = "";
    }
    // A single sentence longer than the limit still has to go somewhere; break
    // it on a space rather than mid-word.
    if (sentence.length > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = "";
      let rest = sentence.trim();
      while (rest.length > maxChars) {
        const cut = rest.lastIndexOf(" ", maxChars);
        const at = cut > 0 ? cut : maxChars;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest;
      continue;
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

/**
 * Speaks interviewer questions aloud via the browser's built-in synthesizer -
 * free, no API key, same family as the recognition already in use.
 */
export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredUri, setPreferredUri] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return;
    setSupported(true);

    try {
      setPreferredUri(localStorage.getItem(VOICE_PREF_KEY));
    } catch {
      // Private mode or blocked storage - the default voice is fine.
    }

    // getVoices() is populated asynchronously in Chrome; it returns an empty
    // array on first call until the engine has loaded.
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (!isSpeechSynthesisSupported()) return;
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  /** Remembers a voice the candidate picked, for this and future interviews. */
  const chooseVoice = useCallback((voiceURI: string | null) => {
    setPreferredUri(voiceURI);
    try {
      if (voiceURI) localStorage.setItem(VOICE_PREF_KEY, voiceURI);
      else localStorage.removeItem(VOICE_PREF_KEY);
    } catch {
      // Not persisting is survivable; the choice still applies this session.
    }
  }, []);

  /**
   * Speaks `text`, resolving when the whole thing finishes. Resolves rather
   * than rejects on error so callers can always re-enable the microphone in a
   * `finally` - a swallowed rejection here would leave the mic muted for the
   * rest of the interview.
   */
  const speak = useCallback(
    (text: string, opts: { rate?: number; voiceURI?: string | null } = {}) =>
      new Promise<void>((resolve) => {
        if (!isSpeechSynthesisSupported() || !text.trim()) return resolve();

        cancelledRef.current = false;
        window.speechSynthesis.cancel();

        const voice = pickVoice(
          window.speechSynthesis.getVoices(),
          opts.voiceURI !== undefined ? opts.voiceURI : preferredUri
        );
        const chunks = chunkForSpeech(text);
        let index = 0;

        const done = () => {
          setSpeaking(false);
          resolve();
        };

        const next = () => {
          if (cancelledRef.current || index >= chunks.length) return done();
          const utterance = new SpeechSynthesisUtterance(chunks[index++]);
          if (voice) utterance.voice = voice;
          // Just under conversational pace. Interviewers do not rattle through
          // questions, and it gives the listener time to process the question.
          utterance.rate = opts.rate ?? 0.95;
          utterance.pitch = 1;
          utterance.onend = next;
          // One chunk failing should not swallow the rest of the question.
          utterance.onerror = next;
          window.speechSynthesis.speak(utterance);
        };

        setSpeaking(true);
        next();
      }),
    [preferredUri]
  );

  return {
    speak,
    cancel,
    speaking,
    supported,
    voices,
    englishVoices: rankVoices(voices),
    preferredUri,
    chooseVoice,
  };
}
