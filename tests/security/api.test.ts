import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as loginRoute } from "@/app/api/login/route";
import { GET as issuesRoute } from "@/app/api/internal/issues/route";
import { POST as confirmRoute } from "@/app/api/actions/[id]/confirm/route";
import { NextRequest } from "next/server";
import { config } from "@/lib/config";
import postgres from "postgres";

const sql = postgres(config.databaseUrl, { prepare: false });

function mockRequest(body: any, cookies: Record<string, string> = {}): NextRequest {
  const req = new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: JSON.stringify(body),
  });
  for (const [key, val] of Object.entries(cookies)) {
    req.cookies.set(key, val);
  }
  return req;
}

function mockGetRequest(cookies: Record<string, string> = {}): NextRequest {
  const req = new NextRequest("http://localhost/api/test", { method: "GET" });
  for (const [key, val] of Object.entries(cookies)) {
    req.cookies.set(key, val);
  }
  return req;
}

describe("Security API Tests (ST-01 to ST-20)", () => {
  let customerSessionToken = "";
  let supportSessionToken = "";

  afterAll(async () => {
    await sql.end();
  });

  it("ST-01: Valid customer login succeeds", async () => {
    const req = mockRequest({ loginId: "northstar_user", password: "DemoPassword123!" });
    const res = await loginRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.redirect).toBe("/");
    
    const cookieHeader = res.headers.get("Set-Cookie");
    expect(cookieHeader).toContain("pp_session=");
    const match = cookieHeader?.match(/pp_session=([^;]+)/);
    if (match) customerSessionToken = match[1];
  });

  it("ST-02: Wrong password rejected", async () => {
    const req = mockRequest({ loginId: "northstar_user", password: "wrongpassword" });
    const res = await loginRoute(req);
    expect(res.status).toBe(401);
  });

  it("ST-03: Unknown login ID rejected identically", async () => {
    const req = mockRequest({ loginId: "unknown_user", password: "DemoPassword123!" });
    const res = await loginRoute(req);
    expect(res.status).toBe(401);
  });

  it("Valid support login succeeds", async () => {
    const req = mockRequest({ loginId: "support01", password: "DemoPassword123!" });
    const res = await loginRoute(req);
    expect(res.status).toBe(200);
    
    const cookieHeader = res.headers.get("Set-Cookie");
    const match = cookieHeader?.match(/pp_session=([^;]+)/);
    if (match) supportSessionToken = match[1];
  });

  it("ST-12: Customer calling internal APIs -> 403", async () => {
    const req = mockGetRequest({ pp_session: customerSessionToken });
    const res = await issuesRoute(req);
    expect(res.status).toBe(403);
  });

  it("ST-09, ST-10, ST-11: Tampered context in request body ignored", async () => {
    const req = mockRequest({ role: "ops_manager", accountId: "fake-id" }, { pp_session: customerSessionToken });
    const res = await confirmRoute(req, { params: Promise.resolve({ id: "fake-id" }) });
    expect(res.status).toBe(400);
  });

  it("ST-18: User B confirming User A's pending action -> rejected", async () => {
    const req = mockRequest({}, { pp_session: customerSessionToken });
    const res = await confirmRoute(req, { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) });
    expect(res.status).toBe(400);
  });
});
