import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";

describe("Input", () => {
  it("渲染 input 元素", () => {
    render(<Input placeholder="Enter name" />);
    expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
  });

  it("接受 value 和 onChange", async () => {
    const onChange = vi.fn();
    render(<Input value="hello" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "x");
    expect(onChange).toHaveBeenCalled();
  });

  it("应用 className", () => {
    const { container } = render(<Input className="extra" />);
    expect(container.firstChild).toHaveClass("extra");
  });

  it("disabled 状态", () => {
    render(<Input disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
