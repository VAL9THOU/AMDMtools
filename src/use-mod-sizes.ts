import { useCallback, useEffect, useRef, useState } from "react";
import type { ArmaModEntry, ModSizeMap } from "../packages/core/src";
import { fetchModSizes, computeModlistTotal } from "./steam-sizes";

export interface ModSizesState {
  sizes: ModSizeMap;
  totalA: number;
  totalB: number;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: ModSizesState = {
  sizes: {},
  totalA: 0,
  totalB: 0,
  loading: false,
  error: null
};

export function useModSizes(
  modsA: ArmaModEntry[] | null,
  modsB: ArmaModEntry[] | null,
  enabled: boolean
): ModSizesState {
  const [state, setState] = useState<ModSizesState>(EMPTY_STATE);
  const generationRef = useRef(0);

  const doFetch = useCallback(
    async (
      allMods: ArmaModEntry[],
      listA: ArmaModEntry[],
      listB: ArmaModEntry[],
      generation: number
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await fetchModSizes(allMods);

        if (generationRef.current !== generation) return;

        const totalA = computeModlistTotal(listA, result.sizes);
        const totalB = computeModlistTotal(listB, result.sizes);

        setState({
          sizes: result.sizes,
          totalA,
          totalB,
          loading: false,
          error: result.partial
            ? "Some mod sizes could not be loaded."
            : null
        });
      } catch {
        if (generationRef.current !== generation) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Failed to fetch mod sizes."
        }));
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || (!modsA && !modsB)) {
      setState(EMPTY_STATE);
      return;
    }

    const allMods = [...(modsA ?? []), ...(modsB ?? [])];
    if (allMods.length === 0) {
      setState(EMPTY_STATE);
      return;
    }

    const generation = ++generationRef.current;
    void doFetch(allMods, modsA ?? [], modsB ?? [], generation);
  }, [enabled, modsA, modsB, doFetch]);

  return state;
}
