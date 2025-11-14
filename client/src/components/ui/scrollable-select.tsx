"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useScrollableItems, type ScrollableItem } from "@/hooks/use-scrollable-items"

const ScrollableSelect = SelectPrimitive.Root

const ScrollableSelectGroup = SelectPrimitive.Group

const ScrollableSelectValue = SelectPrimitive.Value

const ScrollableSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
ScrollableSelectTrigger.displayName = SelectPrimitive.Trigger.displayName

// Helper function to convert various data formats to ScrollableItem
function normalizeItems(items: any[]): ScrollableItem[] {
  if (!items || !Array.isArray(items)) return [];
  
  return items.map((item, index) => {
    // If already in correct format
    if (item && typeof item === 'object' && item.id && item.value && item.label) {
      return item as ScrollableItem;
    }
    
    // If it's a ConfigOption type
    if (item && typeof item === 'object' && item.id && item.value) {
      return {
        id: item.id,
        value: item.value,
        label: item.value
      };
    }
    
    // If it's a Leadership type
    if (item && typeof item === 'object' && item.id && item.nome) {
      return {
        id: item.id,
        value: item.nome,
        label: item.nome
      };
    }
    
    // If it's a simple string
    if (typeof item === 'string') {
      return {
        id: `item-${index}`,
        value: item,
        label: item
      };
    }
    
    // Default fallback
    return {
      id: `item-${index}`,
      value: String(item),
      label: String(item)
    };
  });
}

interface ScrollableSelectContentProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  items: any[];
  initialLoadCount?: number;
  loadMoreCount?: number;
  placeholder?: string;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

const ScrollableSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  ScrollableSelectContentProps
>(({ className, children, items, initialLoadCount = 10, loadMoreCount = 10, placeholder, emptyMessage = "Nenhum item encontrado", searchable = true, searchPlaceholder = "Buscar...", position = "popper", ...props }, ref) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hasMounted, setHasMounted] = React.useState(false);
  
  // Filter items based on search term
  const filteredItems = React.useMemo(() => {
    const normalizedItems = normalizeItems(items);
    if (!searchTerm) return normalizedItems;
    
    return normalizedItems.filter((item) => {
      return String(item.label).toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [items, searchTerm]);

  // Prevent input blur on re-render
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    // Force focus to stay on input after state update
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  }, []);
  
  const { displayedItems, hasMore, handleScroll, loadMore } = useScrollableItems({
    items: filteredItems,
    initialLoadCount,
    loadMoreCount
  });
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Focus input when dropdown opens
  React.useEffect(() => {
    if (searchable && !hasMounted) {
      setHasMounted(true);
      // Use setTimeout to ensure DOM is ready
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
      
      return () => clearTimeout(timer);
    }
  }, [searchable, hasMounted]);

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      setSearchTerm("");
      setHasMounted(false);
    };
  }, []);

  React.useEffect(() => {
    // Wait for the next tick to ensure DOM is ready
    const timer = setTimeout(() => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) return;

      const checkScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollElement;
        
        // Only check if element has content
        if (scrollHeight > 0 && clientHeight > 0) {
          // Check if we're near the bottom
          const distanceToBottom = scrollHeight - scrollTop - clientHeight;
          
          if (distanceToBottom < 20 && hasMore) {
            loadMore();
          }
        }
      };

      // Add scroll listener
      scrollElement.addEventListener('scroll', checkScroll, { passive: true });
      
      // Initial check
      checkScroll();
      
      return () => {
        scrollElement.removeEventListener('scroll', checkScroll);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [hasMore, loadMore, displayedItems.length]);

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        {...props}
      >
        {searchable && items.length > 0 && (
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              type="text"
              className="flex h-8 w-full rounded-md bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={handleInputChange}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") {
                  setSearchTerm("");
                  setTimeout(() => {
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }, 0);
                }
              }}
            />
          </div>
        )}
        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
          <ChevronUp className="h-4 w-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          <div
            ref={scrollRef}
            className="max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
            onScroll={handleScroll}
            onWheel={handleScroll}
            style={{ maxHeight: "288px", overflowY: "auto" }}
          >
            {displayedItems.length === 0 ? (
              <div className="py-6 text-center text-sm">
                {searchTerm ? "Nenhum resultado encontrado" : emptyMessage}
              </div>
            ) : (
              <>
                {displayedItems.map((item) => (
                  <SelectPrimitive.Item
                    key={item.id}
                    value={item.value}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>
                      {item.label}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
                {hasMore && (
                  <div className="py-2 text-center text-xs text-muted-foreground">
                    Role para ver mais itens...
                  </div>
                )}
              </>
            )}
          </div>
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
          <ChevronDown className="h-4 w-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
ScrollableSelectContent.displayName = SelectPrimitive.Content.displayName

const ScrollableSelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
ScrollableSelectLabel.displayName = SelectPrimitive.Label.displayName

const ScrollableSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
ScrollableSelectItem.displayName = SelectPrimitive.Item.displayName

const ScrollableSelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
ScrollableSelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  ScrollableSelect,
  ScrollableSelectGroup,
  ScrollableSelectValue,
  ScrollableSelectTrigger,
  ScrollableSelectContent,
  ScrollableSelectLabel,
  ScrollableSelectItem,
  ScrollableSelectSeparator,
}