import { renderHook, act } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { useControlledOpen } from "@/hooks/useControlledOpen";

describe("useControlledOpen", () => {
  test("starts closed when no props provided", () => {
    const { result } = renderHook(() => useControlledOpen());
    expect(result.current[0]).toBe(false);
  });

  test("opens and closes internally (uncontrolled)", () => {
    const { result } = renderHook(() => useControlledOpen());
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });

  test("uses openProp when provided", () => {
    const { result, rerender } = renderHook(
      ({ open }) => useControlledOpen(open),
      { initialProps: { open: true as boolean | undefined } }
    );
    expect(result.current[0]).toBe(true);
    rerender({ open: false });
    expect(result.current[0]).toBe(false);
  });

  test("calls onOpenChange when provided, internal state unchanged", () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useControlledOpen(false, onOpenChange)
    );

    act(() => result.current[1](true));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    // open still reads from openProp (false), not internal state
    expect(result.current[0]).toBe(false);
  });

  test("openProp overrides internal state on rerender", () => {
    const { result, rerender } = renderHook(
      ({ open }) => useControlledOpen(open),
      { initialProps: { open: undefined as boolean | undefined } }
    );

    // toggle internal state to true
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);

    // now provide openProp = false — should override
    rerender({ open: false });
    expect(result.current[0]).toBe(false);
  });
});
