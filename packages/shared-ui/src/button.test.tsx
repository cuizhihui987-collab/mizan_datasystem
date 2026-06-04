import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("渲染子元素", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("点击时调用 onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disabled 时不会触发 onClick", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("应用 variant 样式", () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect(container.firstChild).toHaveClass("bg-destructive");
  });

  it("应用 size 样式", () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.firstChild).toHaveClass("h-9");
  });

  it("额外 className 被应用", () => {
    const { container } = render(<Button className="extra-class">Test</Button>);
    expect(container.firstChild).toHaveClass("extra-class");
  });

  it("asChild 时渲染为 Slot", () => {
    const { container } = render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>
    );
    expect(container.querySelector("a")).toBeTruthy();
    expect(container.querySelector("button")).toBeFalsy();
  });
});
