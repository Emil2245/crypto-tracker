import { useState } from "react";

export function useControlledOpen(
  openProp?: boolean,
  onOpenChange?: (open: boolean) => void
) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  return [open, setOpen] as const;
}
