import { useState, useEffect, useMemo, useCallback } from "react";

export interface ScrollableItem {
  id: string;
  value: string;
  label: string;
}

interface UseScrollableItemsOptions {
  items: ScrollableItem[];
  initialLoadCount?: number;
  loadMoreCount?: number;
}

export function useScrollableItems({
  items,
  initialLoadCount = 5,
  loadMoreCount = 5
}: UseScrollableItemsOptions) {
  const [displayedCount, setDisplayedCount] = useState(initialLoadCount);

  // Reset displayed count when items change
  useEffect(() => {
    setDisplayedCount(initialLoadCount);
  }, [items, initialLoadCount]);

  // Get the items to display
  const displayedItems = useMemo(() => {
    return items.slice(0, displayedCount);
  }, [items, displayedCount]);

  // Check if there are more items to load
  const hasMore = useMemo(() => {
    return displayedCount < items.length;
  }, [displayedCount, items.length]);

  // Load more items
  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayedCount(prev => Math.min(prev + loadMoreCount, items.length));
    }
  }, [hasMore, loadMoreCount, items.length]);

  // Handle scroll event to load more items
  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // Load more when user scrolls near the bottom (within 50px)
    if (scrollHeight - scrollTop - clientHeight < 50 && hasMore) {
      loadMore();
    }
  }, [hasMore, loadMore]);

  return {
    displayedItems,
    hasMore,
    loadMore,
    handleScroll,
    totalCount: items.length,
    displayedCount
  };
}