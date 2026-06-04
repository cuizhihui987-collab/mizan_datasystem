import { vi } from "vitest";

export interface MockSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  expires: string;
}

export function createMockSession(
  overrides?: Partial<MockSession>
): MockSession {
  return {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
      role: "ADMIN",
      ...overrides?.user,
    },
    expires: "2099-12-31T23:59:59.000Z",
    ...overrides,
  };
}

export function mockGetServerSession(session?: MockSession) {
  const effectiveSession = session ?? createMockSession();

  vi.mock("next-auth", async (importOriginal) => {
    const original = await importOriginal();
    return {
      ...original,
      getServerSession: vi.fn().mockResolvedValue(effectiveSession),
    };
  });
}

export function mockUnauthenticated() {
  vi.mock("next-auth", async (importOriginal) => {
    const original = await importOriginal();
    return {
      ...original,
      getServerSession: vi.fn().mockResolvedValue(null),
    };
  });
}
