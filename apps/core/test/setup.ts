import { vi } from "vitest";

vi.mock("next-auth", async () => {
  const actual = await vi.importActual("next-auth");
  return {
    ...actual,
    getServerSession: vi.fn().mockResolvedValue({
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
        role: "ADMIN",
      },
      expires: "2099-12-31T23:59:59.000Z",
    }),
  };
});
