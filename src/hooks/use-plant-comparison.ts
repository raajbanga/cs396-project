import { useState, useCallback } from "react";

export interface UsePlantComparisonOptions {
  maxLimit?: number;
  minLimit?: number;
}

export function usePlantComparison(options: UsePlantComparisonOptions = {}) {
  const { maxLimit = 4, minLimit = 2 } = options;
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const toggleCompare = useCallback(
    (id: number) => {
      setCompareIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((x) => x !== id);
        }
        if (prev.length >= maxLimit) {
          alert(`Maximum of ${maxLimit} facilities can be compared simultaneously.`);
          return prev;
        }
        return [...prev, id];
      });
    },
    [maxLimit],
  );

  const removeCompare = useCallback((id: number) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareIds([]);
  }, []);

  const isSelected = useCallback(
    (id: number) => compareIds.includes(id),
    [compareIds],
  );

  const canCompare = compareIds.length >= minLimit;
  const count = compareIds.length;
  const isMaxReached = count >= maxLimit;

  return {
    compareIds,
    setCompareIds,
    isCompareOpen,
    setIsCompareOpen,
    toggleCompare,
    removeCompare,
    clearCompare,
    isSelected,
    canCompare,
    count,
    isMaxReached,
    maxLimit,
    minLimit,
  };
}

export type UsePlantComparisonReturn = ReturnType<typeof usePlantComparison>;
