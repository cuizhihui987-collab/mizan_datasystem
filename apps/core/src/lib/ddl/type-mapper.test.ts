import { describe, it, expect } from "vitest";
import { mapDataType, isTypeSupported } from "./type-mapper";

describe("mapDataType", () => {
  it("STRING 无参数默认 VARCHAR(255)", () => {
    expect(mapDataType("STRING", null)).toBe("VARCHAR(255)");
  });

  it("STRING 带长度参数", () => {
    expect(mapDataType("STRING", '{"length":100}')).toBe("VARCHAR(100)");
  });

  it("INTEGER 映射为 INTEGER", () => {
    expect(mapDataType("INTEGER", null)).toBe("INTEGER");
  });

  it("BIGINT 也映射为 INTEGER", () => {
    expect(mapDataType("BIGINT", null)).toBe("INTEGER");
  });

  it("FLOAT/DOUBLE 映射为 REAL", () => {
    expect(mapDataType("FLOAT", null)).toBe("REAL");
    expect(mapDataType("DOUBLE", null)).toBe("REAL");
  });

  it("BOOLEAN 映射为 INTEGER", () => {
    expect(mapDataType("BOOLEAN", null)).toBe("INTEGER");
  });

  it("DATE/DATETIME/TIME 映射为 TEXT", () => {
    expect(mapDataType("DATE", null)).toBe("TEXT");
    expect(mapDataType("DATETIME", null)).toBe("TEXT");
    expect(mapDataType("TIME", null)).toBe("TEXT");
  });

  it("JSON 映射为 TEXT", () => {
    expect(mapDataType("JSON", null)).toBe("TEXT");
  });

  it("未知类型默认 TEXT", () => {
    expect(mapDataType("BLOB", null)).toBe("TEXT");
  });
});

describe("isTypeSupported", () => {
  it("支持所有标准类型", () => {
    expect(isTypeSupported("STRING")).toBe(true);
    expect(isTypeSupported("INTEGER")).toBe(true);
    expect(isTypeSupported("FLOAT")).toBe(true);
    expect(isTypeSupported("BOOLEAN")).toBe(true);
    expect(isTypeSupported("DATE")).toBe(true);
    expect(isTypeSupported("DATETIME")).toBe(true);
    expect(isTypeSupported("TEXT")).toBe(true);
  });

  it("不支持未知类型", () => {
    expect(isTypeSupported("XML")).toBe(false);
    expect(isTypeSupported("BLOB")).toBe(false);
  });
});
