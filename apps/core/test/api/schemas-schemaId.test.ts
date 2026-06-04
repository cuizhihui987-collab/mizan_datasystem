import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = {
  schema: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }),
  },
};

vi.mock("@mizan/database", () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

describe("GET /api/schemas/[schemaId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回 schema 详情", async () => {
    mockPrisma.schema.findFirst.mockResolvedValue({
      id: "s1",
      name: "Test Schema",
      status: "ACTIVE",
      userId: "test-user-id",
      tables: [],
    });

    const { GET } = await import("@/app/api/schemas/[schemaId]/route");
    const req = new NextRequest("http://localhost/api/schemas/s1");
    const response = await GET(req, { params: Promise.resolve({ schemaId: "s1" }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe("Test Schema");
  });

  it("不存在的 schema 返回 404", async () => {
    mockPrisma.schema.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/schemas/[schemaId]/route");
    const req = new NextRequest("http://localhost/api/schemas/nonexistent");
    const response = await GET(req, { params: Promise.resolve({ schemaId: "nonexistent" }) });
    expect(response.status).toBe(404);
  });
});
