import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"

import { cn } from "@/lib/utils"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex w-full flex-col gap-4",
        // Nav is a SIBLING of Month (not a child), positioned absolutely at
        // the top of the relative `months` container. Buttons pushed to either
        // end with justify-between, sitting over the empty px-9 gutters of the
        // month caption below.
        nav: "absolute inset-x-0 top-0 z-10 flex h-9 w-full items-center justify-between",
        button_previous:
          "inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-secondary hover:text-primary aria-disabled:pointer-events-none aria-disabled:opacity-40",
        button_next:
          "inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-secondary hover:text-primary aria-disabled:pointer-events-none aria-disabled:opacity-40",
        month_caption:
          "flex h-9 w-full items-center justify-center px-10",
        caption_label:
          "text-sm font-semibold tracking-tight select-none",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground",
        week: "mt-1 flex w-full",
        day: "relative size-9 p-0 text-center",
        day_button:
          "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent font-mono text-sm font-medium tabular-nums transition-colors hover:bg-secondary hover:text-primary aria-selected:opacity-100",
        selected:
          "[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:font-semibold [&_button:hover]:bg-primary [&_button:hover]:text-primary-foreground",
        today:
          "[&_button]:ring-1 [&_button]:ring-primary/60 [&_button]:text-primary",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/30",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
