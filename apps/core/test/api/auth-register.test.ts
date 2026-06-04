import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@mizan/database", () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

// Mock bcrypt to avoid real hashing
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("$2a$10$hashedpassword"),
  },
  hash: vi.fn().mockResolvedValue("$2a$10$hashedpassword"),
}));

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("成功注册新用户", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "new-user-id",
      email: "new@example.com",
      name: "New User",
    });

    const { POST } = await import("@/app/api/auth/register/route");
    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "new@example.com", password: "password123", name: "New User" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.email).toBe("new@example.com");
  });

  it("重复邮箱返回 409", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing", email: "dup@example.com" });

    const { POST } = await import("@/app/api/auth/register/route");
    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "dup@example.com", password: "password123" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain("已被注册");
  });

  it("无效邮箱返回 400", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "password123" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("密码不足 6 位返回 400", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "123" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
