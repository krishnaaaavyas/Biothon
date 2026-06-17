import { useEffect, useState, useCallback } from "react";
import type { HealthResult } from "./health.functions";
import type { Lang } from "./i18n";

const KEY_RESULT = "hg.result.v1";
const KEY_PROFILE = "hg.profile.v1";
const KEY_HISTORY = "hg.history.v1";
const KEY_LANG = "hg.lang.v1";

export type Profile = {
  age: number;
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  smoking: "never" | "former" | "current";
  exercise: "none" | "light" | "moderate" | "active";
  familyHistory: string;
  symptoms: string;
};

export type StoredResult = HealthResult & { bmi: number };

export type HistoryEntry = {
  date: string;
  overallScore: number;
  bmi: number;
  weightKg: number;
  risks: { diabetes: number; heartDisease: number; hypertension: number };
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("hg:store", { detail: { key } }));
  } catch (err) {
    console.warn("localStorage write failed:", err);
  }
}

function useStored<T>(key: string): [T | null, (value: T | null) => void] {
  const [val, setVal] = useState<T | null>(() => read<T>(key));
  useEffect(() => {
    const sync = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      if (!detail || detail.key === key) setVal(read<T>(key));
    };
    window.addEventListener("hg:store", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("hg:store", sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);
  const setter = useCallback(
    (v: T | null) => {
      write(key, v);
      setVal(v);
    },
    [key],
  );
  return [val, setter];
}

export function useHealthResult() {
  return useStored<StoredResult>(KEY_RESULT);
}
export function useProfile() {
  return useStored<Profile>(KEY_PROFILE);
}
export function useHistory(): [HistoryEntry[], (entries: HistoryEntry[]) => void] {
  const [list, setList] = useStored<HistoryEntry[]>(KEY_HISTORY);
  return [list ?? [], setList];
}
export function useLangPref(): [Lang, (l: Lang) => void] {
  const [val, setVal] = useStored<Lang>(KEY_LANG);
  return [val ?? "en", (l) => setVal(l)];
}

export function pushHistory(entry: HistoryEntry) {
  const cur = read<HistoryEntry[]>(KEY_HISTORY) ?? [];
  write(KEY_HISTORY, [...cur, entry]);
}
