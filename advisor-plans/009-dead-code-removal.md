# Plan 009: Remove dead code and unused exports

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 736bad3..HEAD -- src/lib/calculations.ts src/components/ui/table.tsx src/components/ui/card.tsx src/components/ui/dialog.tsx src/components/ui/dropdown-menu.tsx src/components/ui/popover.tsx src/components/ui/scroll-area.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 002 (formatPercent hoisting — do this plan after 002 to avoid merge conflicts)
- **Category**: tech-debt
- **Planned at**: commit `736bad3`, 2026-09-04

## Why this matters

Dead exports inflate bundle tree-shaking work and mislead future contributors into thinking these are part of the app's public API. The `ui/table.tsx` module in particular is a full component set with zero consumers. Removing dead code reduces cognitive load and maintenance surface.

## Current state

- `src/lib/calculations.ts:40-47` — `formatPercent` is exported but never imported anywhere in the codebase:
```typescript
export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(value);
}
```

- `src/components/ui/table.tsx:105-114` — entire module (7 exports: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`) is never imported by app code
- `src/components/ui/card.tsx:95-103` — exports `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardFooter`; only `Card` and `CardContent` are imported by app code
- `src/components/ui/dialog.tsx:149-160` — exports `DialogFooter` and `DialogDescription`; neither is imported
- `src/components/ui/dropdown-menu.tsx:250-266` — exports 12 items; only `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` are imported
- `src/components/ui/popover.tsx:81-88` — exports `PopoverHeader`, `PopoverTitle`, `PopoverDescription`; none imported
- `src/components/ui/scroll-area.tsx:52` — `ScrollBar` is never imported

**Important**: The `ui/` files are shadcn-generated. The convention is to keep unused exports available for future use. Only remove `formatPercent` (app code, not a shadcn component) and `ui/table.tsx` (entirely unused). Leave the unused exports in other `ui/` files — they're shadcn's standard surface area and removing them would make it harder to add new shadcn components later.

## Commands you will need

| Purpose   | Command                    | Expected on success                      |
|-----------|----------------------------|------------------------------------------|
| Typecheck | `bun run build`            | exit 0, no errors                        |
| Lint      | `bun run lint`             | exit 1, only 3 pre-existing errors       |

## Scope

**In scope**:
- `src/lib/calculations.ts` — remove `formatPercent` function
- `src/components/ui/table.tsx` — delete entire file (if truly zero imports)

**Out of scope**:
- Unused shadcn exports in `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `scroll-area.tsx` — leave them (shadcn convention)
- No behavior changes

## Git workflow

- Branch: create a feature branch from current HEAD
- One commit with message: `chore: remove dead code — formatPercent and unused table component`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Verify formatPercent is truly unused

**Verify**: `grep -rn "formatPercent" src/ --include="*.ts" --include="*.tsx"` → only matches in `src/lib/calculations.ts` (definition). No imports.

### Step 2: Remove formatPercent

In `src/lib/calculations.ts`, delete the `formatPercent` function (lines 40-47):

```typescript
// DELETE THIS:
export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(value);
}
```

**Verify**: `bun run build` → exit 0

### Step 3: Verify table.tsx is truly unused

**Verify**: `grep -rn "from.*ui/table" src/ --include="*.ts" --include="*.tsx"` → no matches. Also check: `grep -rn "Table\b" src/ --include="*.tsx"` → only matches in `ui/table.tsx` itself (no app code references).

### Step 4: Delete table.tsx

**Verify**: `grep -rn "Table" src/ --include="*.tsx" | grep -v "ui/table.tsx"` → no matches (no app code uses the Table component)

If confirmed unused, delete the file:
```bash
rm src/components/ui/table.tsx
```

**Verify**: `bun run build` → exit 0

### Step 5: Final verification

**Verify**: `bun run build` → exit 0, no errors
**Verify**: `bun run lint` → only 3 pre-existing errors
**Verify**: `grep -rn "formatPercent" src/` → no matches

## Test plan

- No new tests needed — removing dead code is a no-op behavior-wise
- Verification: `bun run build` passes, no imports break

## Done criteria

- [ ] `bun run build` exits 0
- [ ] `bun run lint` shows only 3 pre-existing errors
- [ ] `grep -rn "formatPercent" src/` → no matches
- [ ] `src/components/ui/table.tsx` does not exist
- [ ] `advisor-plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- A step's verification fails twice after a reasonable fix attempt.
- `formatPercent` or `Table` is found to be imported somewhere the grep missed.

## Maintenance notes

- Plan 002 hoists `formatPercent`'s `Intl.NumberFormat` to module scope before this plan removes it. Execute 002 first to avoid editing the same lines twice.
- If shadcn components are added in the future, the `ui/` exports may become needed. This plan only removes `table.tsx` (entirely unused) and `formatPercent` (app code, not shadcn).
