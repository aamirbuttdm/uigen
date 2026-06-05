// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SignJWT, decodeJwt, decodeProtectedHeader } from "jose";
import type { NextRequest } from "next/server";

// `server-only` throws when imported outside a React Server Component; stub it out.
vi.mock("server-only", () => ({}));

// In-memory stand-in for the Next.js cookie store.
const cookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import {
  createSession,
  getSession,
  deleteSession,
  verifySession,
} from "@/lib/auth";

const COOKIE_NAME = "auth-token";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

function buildRequest(token?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        token && name === COOKIE_NAME ? { name, value: token } : undefined,
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  cookieStore.set.mockReset();
  cookieStore.get.mockReset();
  cookieStore.delete.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSession", () => {
  test("sets a cookie with a verifiable JWT containing the payload", async () => {
    await createSession("user-123", "member@sohohouse.com");

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const [name, token, options] = cookieStore.set.mock.calls[0];

    expect(name).toBe(COOKIE_NAME);
    expect(typeof token).toBe("string");

    const session = await getSessionFromToken(token);
    expect(session.userId).toBe("user-123");
    expect(session.email).toBe("member@sohohouse.com");

    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    expect(options.expires).toBeInstanceOf(Date);
  });

  test("sets the cookie to expire roughly 7 days out", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-05T00:00:00.000Z");
    vi.setSystemTime(now);

    await createSession("user-1", "a@b.com");

    const options = cookieStore.set.mock.calls[0][2];
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(options.expires.getTime()).toBe(now.getTime() + sevenDays);
  });

  test("does not mark the cookie secure outside production", async () => {
    await createSession("user-1", "a@b.com");
    const options = cookieStore.set.mock.calls[0][2];
    expect(options.secure).toBe(false);
  });

  test("marks the cookie secure in production", async () => {
    const prev = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    try {
      await createSession("user-1", "a@b.com");
      const options = cookieStore.set.mock.calls[0][2];
      expect(options.secure).toBe(true);
    } finally {
      vi.stubEnv("NODE_ENV", prev ?? "test");
    }
  });

  test("signs an HS256 token", async () => {
    await createSession("user-1", "a@b.com");
    const token = cookieStore.set.mock.calls[0][1];
    expect(decodeProtectedHeader(token).alg).toBe("HS256");
  });

  test("embeds expiresAt in the token payload", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-05T00:00:00.000Z");
    vi.setSystemTime(now);

    await createSession("user-1", "a@b.com");
    const token = cookieStore.set.mock.calls[0][1];
    const claims = decodeJwt(token);

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(new Date(claims.expiresAt as string).getTime()).toBe(
      now.getTime() + sevenDays
    );
  });

  test("sets iat and exp claims roughly 7 days apart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T00:00:00.000Z"));

    await createSession("user-1", "a@b.com");
    const claims = decodeJwt(cookieStore.set.mock.calls[0][1]);

    expect(claims.iat).toBeTypeOf("number");
    expect(claims.exp).toBeTypeOf("number");
    // jose stores these as whole seconds
    expect(claims.exp! - claims.iat!).toBe(7 * 24 * 60 * 60);
  });

  test("preserves userId and email containing unusual characters", async () => {
    const userId = "user|with:weird/chars";
    const email = "a.b+tag@sub.sohohouse.co.uk";
    await createSession(userId, email);

    const session = await getSessionFromToken(cookieStore.set.mock.calls[0][1]);
    expect(session.userId).toBe(userId);
    expect(session.email).toBe(email);
  });

  test("issues a distinct token per call", async () => {
    await createSession("user-1", "a@b.com");
    const first = cookieStore.set.mock.calls[0][1];

    cookieStore.set.mockClear();
    await createSession("user-2", "c@d.com");
    const second = cookieStore.set.mock.calls[0][1];

    expect(first).not.toBe(second);
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });

  test("returns the payload for a valid token", async () => {
    const token = await signToken({
      userId: "user-9",
      email: "host@sohohouse.com",
    });
    cookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-9");
    expect(session?.email).toBe("host@sohohouse.com");
  });

  test("returns null for a token signed with the wrong secret", async () => {
    const token = await new SignJWT({ userId: "x", email: "y@z.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(new TextEncoder().encode("the-wrong-secret"));
    cookieStore.get.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await new SignJWT({ userId: "x", email: "y@z.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("-1h")
      .setIssuedAt()
      .sign(JWT_SECRET);
    cookieStore.get.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    cookieStore.get.mockReturnValue({ value: "not-a-jwt" });
    expect(await getSession()).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth cookie", async () => {
    await deleteSession();
    expect(cookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("verifySession", () => {
  test("returns null when the request has no auth cookie", async () => {
    expect(await verifySession(buildRequest())).toBeNull();
  });

  test("returns the payload for a request with a valid token", async () => {
    const token = await signToken({
      userId: "user-42",
      email: "manager@sohohouse.com",
    });

    const session = await verifySession(buildRequest(token));
    expect(session?.userId).toBe("user-42");
    expect(session?.email).toBe("manager@sohohouse.com");
  });

  test("returns null for a request with an invalid token", async () => {
    expect(await verifySession(buildRequest("garbage"))).toBeNull();
  });

  test("does not read from the cookie store", async () => {
    const token = await signToken({ userId: "u", email: "e@e.com" });
    await verifySession(buildRequest(token));
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
});

test("createSession produces a token that verifySession accepts (round trip)", async () => {
  await createSession("user-round-trip", "loop@sohohouse.com");
  const token = cookieStore.set.mock.calls[0][1];

  const session = await verifySession(buildRequest(token));
  expect(session?.userId).toBe("user-round-trip");
  expect(session?.email).toBe("loop@sohohouse.com");
});

async function signToken(payload: { userId: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

async function getSessionFromToken(token: string) {
  cookieStore.get.mockReturnValue({ value: token });
  const session = await getSession();
  if (!session) throw new Error("expected a session");
  return session;
}
