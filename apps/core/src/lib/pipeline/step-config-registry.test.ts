import { describe, it, expect } from "vitest";
import { getVisibleFields, getNestedValue, setNestedValue, stepConfigFields, stepTypeMeta } from "./step-config-registry";
import type { ConfigFieldDef } from "./step-config-registry";

describe("stepConfigFields", () => {
  it("所有 stepType 在 stepTypeMeta 中都有对应条目", () => {
    const definedTypes = Object.keys(stepConfigFields);
    const metaTypes = Object.keys(stepTypeMeta);
    for (const t of definedTypes) {
      expect(metaTypes).toContain(t);
    }
  });

  it("source_table 包含 sourceTableId 字段", () => {
    const fields = stepConfigFields.source_table;
    expect(fields.some((f) => f.key === "sourceTableId" && f.optionSource === "schema-tables")).toBe(true);
  });

  it("source_api 中 authConfig 在 authType=basic 时有条件显示", () => {
    const fields = stepConfigFields.source_api;
    const usernameField = fields.find((f) => f.key === "authConfig.username");
    expect(usernameField?.showIf).toEqual({ field: "authType", value: "basic" });
  });
});

describe("getVisibleFields", () => {
  const defs: ConfigFieldDef[] = [
    { key: "name", label: "Name", type: "text" },
    { key: "secret", label: "Secret", type: "text", showIf: { field: "showSecret", value: "true" } },
  ];

  it("无条件字段总是可见", () => {
    const visible = getVisibleFields(defs, {});
    expect(visible.some((f) => f.key === "name")).toBe(true);
  });

  it("条件字段在值匹配时可见", () => {
    const visible = getVisibleFields(defs, { showSecret: "true" });
    expect(visible.some((f) => f.key === "secret")).toBe(true);
  });

  it("条件字段在值不匹配时隐藏", () => {
    const visible = getVisibleFields(defs, { showSecret: "false" });
    expect(visible.some((f) => f.key === "secret")).toBe(false);
  });
});

describe("getNestedValue", () => {
  it("获取简单键值", () => {
    expect(getNestedValue({ a: 1 }, "a")).toBe(1);
  });

  it("获取嵌套键值", () => {
    expect(getNestedValue({ auth: { config: { token: "xyz" } } }, "auth.config.token")).toBe("xyz");
  });

  it("路径不存在返回 undefined", () => {
    expect(getNestedValue({ a: 1 }, "b.c")).toBeUndefined();
  });

  it("中间值为 null 返回 undefined", () => {
    expect(getNestedValue({ a: null }, "a.b")).toBeUndefined();
  });
});

describe("setNestedValue", () => {
  it("设置简单键值", () => {
    expect(setNestedValue({ a: 1 }, "b", 2)).toEqual({ a: 1, b: 2 });
  });

  it("设置嵌套键值", () => {
    const result = setNestedValue({}, "auth.config.token", "xyz");
    expect(result).toEqual({ auth: { config: { token: "xyz" } } });
  });

  it("不修改原始对象", () => {
    const orig = { a: 1 };
    const result = setNestedValue(orig, "b", 2);
    expect(orig).toEqual({ a: 1 });
    expect(result).toEqual({ a: 1, b: 2 });
  });
});
