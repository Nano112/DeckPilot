import { useCallback, useMemo, useState } from "react";
import type { PageConfig } from "shared";

export type NavigationDirection = "left" | "right" | "up" | "down";

interface UsePageNavigationOptions {
  pages: PageConfig[];
  gridSize?: { rows: number; cols: number };
}

export function usePageNavigation({ pages, gridSize }: UsePageNavigationOptions) {
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<NavigationDirection | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Ensure every page has a gridPosition (fallback for pre-v8 configs)
  const pagesWithPositions = useMemo(
    () =>
      pages.map((p, i) => (p.gridPosition ? p : { ...p, gridPosition: { row: 0, col: i } })),
    [pages]
  );

  // Build coordinate→page lookup map
  const pageMap = useMemo(() => {
    const map = new Map<string, PageConfig>();
    for (const page of pagesWithPositions) {
      const key = `${page.gridPosition.row},${page.gridPosition.col}`;
      map.set(key, page);
    }
    return map;
  }, [pagesWithPositions]);

  // Derive grid bounds from pageGridSize or max page coordinates
  const gridBounds = useMemo(() => {
    if (gridSize) return gridSize;
    if (pagesWithPositions.length === 0) return { rows: 1, cols: 1 };
    let maxRow = 0;
    let maxCol = 0;
    for (const page of pagesWithPositions) {
      maxRow = Math.max(maxRow, page.gridPosition.row);
      maxCol = Math.max(maxCol, page.gridPosition.col);
    }
    return { rows: maxRow + 1, cols: maxCol + 1 };
  }, [pagesWithPositions, gridSize]);

  // Initialize activePageId to first page if not set
  const effectiveActivePageId = useMemo(() => {
    if (activePageId && pagesWithPositions.some((p) => p.id === activePageId)) {
      return activePageId;
    }
    return pagesWithPositions[0]?.id ?? null;
  }, [activePageId, pagesWithPositions]);

  const activePage = useMemo(
    () => pagesWithPositions.find((p) => p.id === effectiveActivePageId) ?? null,
    [pagesWithPositions, effectiveActivePageId]
  );

  const getPageAt = useCallback(
    (row: number, col: number) => pageMap.get(`${row},${col}`) ?? null,
    [pageMap]
  );

  // Navigate with wraparound: scan in direction, wrap around grid bounds
  const navigatePage = useCallback(
    (direction: NavigationDirection) => {
      if (!activePage || pagesWithPositions.length <= 1) return;
      const { row, col } = activePage.gridPosition;
      const { rows, cols } = gridBounds;

      const deltas: Record<NavigationDirection, [number, number]> = {
        left: [0, -1],
        right: [0, 1],
        up: [-1, 0],
        down: [1, 0],
      };

      const [dr, dc] = deltas[direction];
      let r = row;
      let c = col;

      // Scan up to rows*cols steps (full grid) looking for a page
      for (let i = 0; i < rows * cols; i++) {
        r = (r + dr + rows) % rows;
        c = (c + dc + cols) % cols;
        const found = getPageAt(r, c);
        if (found && found.id !== activePage.id) {
          setTransitionDirection(direction);
          setIsTransitioning(true);
          setActivePageId(found.id);
          return;
        }
      }
    },
    [activePage, pagesWithPositions.length, gridBounds, getPageAt]
  );

  const openOverview = useCallback(() => setOverviewOpen(true), []);
  const closeOverview = useCallback(() => setOverviewOpen(false), []);
  const toggleOverview = useCallback(() => setOverviewOpen((v) => !v), []);

  const finishTransition = useCallback(() => {
    setIsTransitioning(false);
    setTransitionDirection(null);
  }, []);

  return {
    activePageId: effectiveActivePageId,
    setActivePageId,
    activePage,
    navigatePage,
    overviewOpen,
    openOverview,
    closeOverview,
    toggleOverview,
    getPageAt,
    gridBounds,
    transitionDirection,
    isTransitioning,
    finishTransition,
    pageMap,
  };
}
