import { render, screen } from "@testing-library/react";
import { ReturnBadge } from "@/components/ReturnBadge";

describe("ReturnBadge", () => {
  test("renders gain with plus sign", () => {
    render(<ReturnBadge diff={100.5} pct={0.25} />);
    const badge = screen.getByTestId("return-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("+$100.50");
    expect(badge).toHaveTextContent("+25.00%");
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  test("renders loss without plus sign", () => {
    render(<ReturnBadge diff={-50} pct={-0.1} />);
    const badge = screen.getByTestId("return-badge");
    expect(badge).toHaveTextContent("$50.00");
    expect(badge).not.toHaveTextContent("+$50.00");
    expect(badge).toHaveTextContent("-10.00%");
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  test("renders zero case with plus sign (zero treated as gain)", () => {
    render(<ReturnBadge diff={0} pct={0} />);
    const badge = screen.getByTestId("return-badge");
    expect(badge).toHaveTextContent("+$0.00");
    expect(badge).toHaveTextContent("+0.00%");
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  test("size compact uses h-3.5 icon", () => {
    render(<ReturnBadge diff={10} pct={0.01} size="compact" />);
    const arrow = screen.getByTestId("return-badge").querySelector("svg");
    expect(arrow).toHaveClass("h-3.5 w-3.5");
  });

  test("label prop is rendered", () => {
    render(<ReturnBadge diff={10} pct={0.01} label="since acquisition" />);
    expect(screen.getByTestId("return-badge")).toHaveTextContent(
      "since acquisition"
    );
  });
});
