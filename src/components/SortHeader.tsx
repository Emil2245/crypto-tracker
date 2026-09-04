import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

interface SortHeaderProps {
  label: string;
  align?: "left" | "right";
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  id?: string;
}

export function SortHeader({
  label,
  align,
  active,
  dir,
  onClick,
  id,
}: SortHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-1 transition-colors hover:text-foreground",
        align === "right" && "justify-self-end"
      )}
      id={id}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
      )}
    </button>
  );
}
