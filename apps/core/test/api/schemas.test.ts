import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma at the top level (hoisted by vitest)
const mockPrisma = {
  schema: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }),
  },
  tablePermission: {
    count: vi.fn(),
  },
};

vi.mock("@mizan/database", () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

describe("POST /api/schemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("使用有效输入创建 schema", async () => {
    mockPrisma.schema.create.mockResolvedValue({
      id: "s1",
      userId: "test-user-id",
      name: "测试 Schema",
      description: "描述",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { POST } = await import("@/app/api/schemas/route");
    const req = new NextRequest("http://localhost/api/schemas", {
      method: "POST",
      body: JSON.stringify({ name: "测试 Schema", description: "描述" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.name).toBe("测试 Schema");
    expect(mockPrisma.schema.create).toHaveBeenCalledWith({
      data: { userId: "test-user-id", name: "测试 Schema", description: "描述" },
    });
  });

  it("空名称返回 400", async () => {
    const { POST } = await import("@/app/api/schemas/route");
    const req = new NextRequest("http://localhost/api/schemas", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("重复名称返回 409", async () => {
    mockPrisma.schema.create.mockRejectedValue({ code: "P2002" });

    const { POST } = await import("@/app/api/schemas/route");
    const req = new NextRequest("http://localhost/api/schemas", {
      method: "POST",
      body: JSON.stringify({ name: "重复名称" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(409);
  });

  it("未登录时返回 401", async () => {
    // Temporarily make getServerSession return null
    const nextAuth = await import("next-auth");
    const getServerSession = vi.mocked(nextAuth.getServerSession);
    getServerSession.mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/schemas/route");
    const req = new NextRequest("http://localhost/api/schemas", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });
});

describe("GET /api/schemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回 schema 列表", async () => {
    mockPrisma.schema.findMany.mockResolvedValue([
      { id: "s1", name: "Schema 1", userId: "test-user-id", status: "ACTIVE", _count: { tables: 2 }, user: { name: "Test", email: "test@example.com" } },
    ]);

    const { GET } = await import("@/app/api/schemas/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Schema 1");
  });
});
