"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react"
import { cn } from "@/lib/utils"

const SimpleSelect = SelectPrimitive.Root

const SimpleSelectGroup = SelectPrimitive.Group

const SimpleSelectValue = SelectPrimitive.Value

const SimpleSelectTrigger = React.forwardRef<
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
SimpleSelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SimpleSelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SimpleSelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SimpleSelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SimpleSelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

interface SimpleSelectContentProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  items?: any[];
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

const SimpleSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SimpleSelectContentProps
>(({ className, children, position = "popper", items = [], emptyMessage = "Nenhum item encontrado", searchable = true, searchPlaceholder = "Buscar...", ...props }, ref) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [hasMounted, setHasMounted] = React.useState(false);

  // Filter items based on search term
  const filteredItems = React.useMemo(() => {
    if (!searchTerm || items.length === 0) return items;
    
    return items.filter((item) => {
      const label = item.label || item.value || item;
      return String(label).toLowerCase().includes(searchTerm.toLowerCase());
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
        <SimpleSelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {filteredItems.length === 0 && !children ? (
            <div className="py-6 text-center text-sm">
              {searchTerm ? "Nenhum resultado encontrado" : emptyMessage}
            </div>
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const id = item.id || item.value || Math.random().toString()
              const value = item.value || item
              const label = item.label || item.value || item
              
              return (
                <SelectPrimitive.Item
                  key={id}
                  value={value}
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
                    {label}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              )
            })
          ) : (
            children
          )}
        </SelectPrimitive.Viewport>
        <SimpleSelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
})
SimpleSelectContent.displayName = SelectPrimitive.Content.displayName

const SimpleSelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SimpleSelectLabel.displayName = SelectPrimitive.Label.displayName

const SimpleSelectItem = React.forwardRef<
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
SimpleSelectItem.displayName = SelectPrimitive.Item.displayName

const SimpleSelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SimpleSelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  SimpleSelect,
  SimpleSelectGroup,
  SimpleSelectValue,
  SimpleSelectTrigger,
  SimpleSelectContent,
  SimpleSelectLabel,
  SimpleSelectItem,
  SimpleSelectSeparator,
}