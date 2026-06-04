import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("单个字符串", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("多个字符串合并", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("条件假值过滤", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("数组参数", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("处理 undefined", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
  });
});
