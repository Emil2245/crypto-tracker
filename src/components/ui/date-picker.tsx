import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"

interface DatePickerProps {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: (date: Date) => boolean
  className?: string
  id?: string
}

/**
 * Inline date picker — the Calendar sits absolutely positioned below the
 * trigger inside the same DOM context, no portal. This avoids the focus-trap
 * conflict that happens when Base UI's Popover portals out of a parent Dialog
 * (which was swallowing every day-button click and leaving the browser to
 * select the number text on double-click).
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button
        id={id}
        type="button"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-11 w-full justify-start gap-2 rounded-xl px-3.5 font-mono text-sm font-medium",
          !value && "text-muted-foreground font-normal",
          className
        )}
      >
        <CalendarIcon className="h-4 w-4" />
        {value ? format(value, "PPP") : placeholder}
      </Button>

      {open && (
        <div
          className="absolute z-[70] mt-2 left-0 w-auto overflow-hidden rounded-2xl border border-border bg-popover animate-in fade-in-0 slide-in-from-top-2 duration-150"
          style={{
            boxShadow:
              "0 20px 40px rgba(23, 20, 32, 0.16), 0 4px 12px rgba(23, 20, 32, 0.08)",
          }}
        >
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date)
              setOpen(false)
            }}
            disabled={disabled}
            defaultMonth={value}
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
