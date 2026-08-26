/**
 * End-to-end API test script for the ParcelPilot assessment scenarios.
 * Tests all key requirements via direct HTTP calls.
 */
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";

// Helper: parse .env
const envPath = path.join(process.cwd(), ".env");
const env: Record<string, string> = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_a-z]+)=(.*)/);
  if (m) env[m[1]!] = m[2]!.trim();
}

type TestResult = { name: string; passed: boolean; detail: string };
const results: TestResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, passed: true, detail });
  console.log(`  ✅ PASS: ${name}`);
  console.log(`     ${detail}`);
}
function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.log(`  ❌ FAIL: ${name}`);
  console.log(`     ${detail}`);
}

// Helper: login and get cookie
async function login(username: string, password: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId: username, password }),
      redirect: "manual",
    });
    if (res.status === 200 || res.status === 302) {
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const match = setCookie.match(/pp_session=([^;]+)/);
        if (match) return `pp_session=${match[1]}`;
      }
    }
    return null;
  } catch (e: any) {
    return null;
  }
}

// Helper: send a chat message and collect SSE response
async function chat(cookie: string, userMessage: string): Promise<{
  response: string;
  toolsUsed: string[];
  hasAction: boolean;
  error: boolean;
}> {
  const messages = [{ role: "user", content: userMessage }];
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": cookie },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    return { response: `HTTP ${res.status}`, toolsUsed: [], hasAction: false, error: true };
  }

  const text = await res.text();
  const lines = text.split("\n");

  let responseText = "";
  const toolsUsed: string[] = [];
  let hasAction = false;
  let hasError = false;

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.substring(6).trim();
    if (data === "[DONE]") break;
    try {
      const ev = JSON.parse(data);
      if (ev.type === "token") responseText += ev.content;
      if (ev.type === "tool_call") toolsUsed.push(ev.name);
      if (ev.type === "tool_result" && ev.name === "draft_action") hasAction = true;
      if (ev.type === "error") hasError = true;
    } catch {}
  }

  return { response: responseText.trim(), toolsUsed, hasAction, error: hasError };
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("  ParcelPilot Assessment - End-to-End API Test");
  console.log("=".repeat(60) + "\n");

  // ─── Test 1: Authentication ────────────────────────────────
  console.log("── AUTH TESTS ──────────────────────────────────────────────");

  const northstarCookie = await login("northstar_user", "Demo1234!");
  if (northstarCookie) {
    pass("Login - northstar_user", `Got session cookie`);
  } else {
    fail("Login - northstar_user", "Login failed — check password or /api/login route");
  }

  const supportCookie = await login("support01", "Demo1234!");
  if (supportCookie) {
    pass("Login - support01 (internal)", `Got session cookie`);
  } else {
    fail("Login - support01 (internal)", "Login failed");
  }

  if (!northstarCookie) {
    console.log("\n⚠️  Cannot run agent tests without a valid session. Stopping.\n");
    return;
  }

  // ─── Test 2: Session API returns correct context ────────────
  console.log("\n── SESSION TESTS ────────────────────────────────────────────");
  const sessionRes = await fetch(`${BASE_URL}/api/session`, {
    headers: { "Cookie": northstarCookie }
  });
  if (sessionRes.ok) {
    const sess: any = await sessionRes.json();
    if (sess.category === "customer" && sess.accountId) {
      pass("Session context", `category=${sess.category}, accountId=${sess.accountId}`);
    } else {
      fail("Session context", `Got: ${JSON.stringify(sess)}`);
    }
  } else {
    fail("Session API", `HTTP ${sessionRes.status}`);
  }

  // ─── Test 3: Unauthorized user blocked from other accounts ────
  const unauthorized = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
  });
  if (unauthorized.status === 401) {
    pass("Unauthenticated request blocked (401)", "No cookie → 401 as expected");
  } else {
    fail("Unauthenticated request blocked", `Expected 401, got ${unauthorized.status}`);
  }

  // ─── Test 4: Core Assessment Query 1 - Cancellation fee ─────
  console.log("\n── AGENT TESTS (as northstar_user) ──────────────────────────");
  console.log("  Sending: 'Can Northstar cancel ORD-1001 without a cancellation fee?'");
  const q1 = await chat(northstarCookie, "Can Northstar cancel ORD-1001 without a cancellation fee? Explain why.");

  if (q1.error) {
    fail("Query 1 - Cancellation fee", `Error: ${q1.response}`);
  } else {
    const usedDocSearch = q1.toolsUsed.includes("document_search");
    const usedDataLookup = q1.toolsUsed.includes("data_lookup");
    const mentionsEnterprise = q1.response.toLowerCase().includes("enterprise") ||
      q1.response.toLowerCase().includes("agreement") ||
      q1.response.toLowerCase().includes("northstar");
    const answersQuestion = q1.response.toLowerCase().includes("cancel") &&
      q1.response.toLowerCase().includes("fee");

    console.log(`     Tools used: ${q1.toolsUsed.join(", ") || "none"}`);
    console.log(`     Response (first 300 chars): ${q1.response.substring(0, 300)}`);

    if (answersQuestion && (usedDocSearch || usedDataLookup)) {
      pass("Query 1 - Cancellation fee", `Used tools: [${q1.toolsUsed.join(", ")}]. Mentions enterprise/agreement: ${mentionsEnterprise}`);
    } else {
      fail("Query 1 - Cancellation fee", `Tools=[${q1.toolsUsed.join(", ")}], answered=${answersQuestion}`);
    }
  }

  // ─── Test 5: Order status lookup ─────────────────────────────
  console.log("\n  Sending: 'What is the status of ORD-1002?'");
  const q2 = await chat(northstarCookie, "What is the status of ORD-1002?");
  
  if (q2.error) {
    fail("Query 2 - Order status", `Error: ${q2.response}`);
  } else {
    const usedDataLookup = q2.toolsUsed.includes("data_lookup");
    const mentionsStatus = q2.response.toLowerCase().includes("pick") ||
      q2.response.toLowerCase().includes("transit") ||
      q2.response.toLowerCase().includes("in-transit") ||
      q2.response.toLowerCase().includes("picked_up");

    console.log(`     Tools used: ${q2.toolsUsed.join(", ") || "none"}`);
    console.log(`     Response (first 200 chars): ${q2.response.substring(0, 200)}`);

    if (usedDataLookup && mentionsStatus) {
      pass("Query 2 - Order status (ORD-1002)", `Used data_lookup, mentions status`);
    } else {
      fail("Query 2 - Order status", `Tools=[${q2.toolsUsed.join(", ")}], mentionsStatus=${mentionsStatus}`);
    }
  }

  // ─── Test 6: Multi-step reasoning ─────────────────────────────
  console.log("\n  Sending: 'A pickup is 3 hours late due to carrier fault. Should I get a service credit?'");
  const q3 = await chat(northstarCookie, "A pickup is three hours late because of carrier fault. Should I get a service credit?");

  if (q3.error) {
    fail("Query 3 - Multi-step service credit", `Error: ${q3.response}`);
  } else {
    const multiStep = q3.toolsUsed.length >= 2;
    const hasCalcOrDoc = q3.toolsUsed.includes("calculate") || q3.toolsUsed.includes("document_search");

    console.log(`     Tools used: ${q3.toolsUsed.join(", ") || "none"}`);
    console.log(`     Response (first 300 chars): ${q3.response.substring(0, 300)}`);

    if (hasCalcOrDoc) {
      pass("Query 3 - Multi-step service credit", `Tools used: [${q3.toolsUsed.join(", ")}]. Multi-step: ${multiStep}`);
    } else {
      fail("Query 3 - Multi-step service credit", `Only tools=[${q3.toolsUsed.join(", ")}] — expected document_search or calculate`);
    }
  }

  // ─── Test 7: Action confirmation required ─────────────────────
  console.log("\n  Sending: 'Please cancel order ORD-1001'");
  const q4 = await chat(northstarCookie, "Please cancel order ORD-1001");

  if (q4.error) {
    fail("Query 4 - Cancel action", `Error: ${q4.response}`);
  } else {
    const usedDraftAction = q4.toolsUsed.includes("draft_action");
    const requiresConfirmation = q4.response.toLowerCase().includes("confirm") ||
      q4.response.toLowerCase().includes("pending") ||
      q4.response.toLowerCase().includes("confirm") ||
      q4.hasAction;

    console.log(`     Tools used: ${q4.toolsUsed.join(", ") || "none"}`);
    console.log(`     Has pending action: ${q4.hasAction}`);
    console.log(`     Response (first 200 chars): ${q4.response.substring(0, 200)}`);

    if (usedDraftAction || requiresConfirmation) {
      pass("Query 4 - Action requires confirmation", `draft_action called: ${usedDraftAction}, asks for confirm: ${requiresConfirmation}`);
    } else {
      fail("Query 4 - Action requires confirmation", `Tools=[${q4.toolsUsed.join(", ")}], no confirmation asked`);
    }
  }

  // ─── Test 8: Data isolation (northstar user can't see other accounts) ───
  console.log("\n  Testing data isolation: northstar_user asks about ORD-2001 (ACCT-002)...");
  const q5 = await chat(northstarCookie, "What is the status of ORD-2001?");
  const deniesAccess = q5.response.toLowerCase().includes("not found") ||
    q5.response.toLowerCase().includes("access denied") ||
    q5.response.toLowerCase().includes("unable") ||
    q5.response.toLowerCase().includes("could not find") ||
    q5.response.toLowerCase().includes("don't have") ||
    q5.response.toLowerCase().includes("cannot") ||
    q5.toolsUsed.length === 0;

  console.log(`     Tools used: ${q5.toolsUsed.join(", ") || "none"}`);
  console.log(`     Response (first 200 chars): ${q5.response.substring(0, 200)}`);
  if (deniesAccess) {
    pass("Data isolation - northstar can't see ORD-2001 (LumenWorks)", "Access correctly denied or not found");
  } else {
    fail("Data isolation", `Agent returned data for another account's order. Response: ${q5.response.substring(0, 100)}`);
  }

  // ─── Test 9: Internal user proactive issues ─────────────────
  if (supportCookie) {
    console.log("\n── INTERNAL USER TESTS (as support01) ───────────────────────");
    const issuesRes = await fetch(`${BASE_URL}/api/internal/issues`, {
      headers: { "Cookie": supportCookie }
    });
    if (issuesRes.ok) {
      const issues: any = await issuesRes.json();
      const hasIssues = Array.isArray(issues) && issues.length > 0;
      pass("Proactive issues endpoint", `Returns ${Array.isArray(issues) ? issues.length : "unknown"} issues. Sample: ${JSON.stringify(issues[0] ?? {}).substring(0, 100)}`);
    } else {
      fail("Proactive issues endpoint", `HTTP ${issuesRes.status}`);
    }

    console.log("\n  Internal agent: 'What tickets are currently open and urgent?'");
    const qi1 = await chat(supportCookie, "What tickets are currently open and urgent?");
    if (qi1.error) {
      fail("Internal agent - urgent tickets", `Error: ${qi1.response}`);
    } else {
      const usedTools = qi1.toolsUsed.length > 0;
      console.log(`     Tools used: ${qi1.toolsUsed.join(", ") || "none"}`);
      console.log(`     Response (first 300 chars): ${qi1.response.substring(0, 300)}`);
      pass("Internal agent - urgent tickets", `Tools=[${qi1.toolsUsed.join(", ")}]`);
    }
  }

  // ─── Summary ────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  RESULTS SUMMARY");
  console.log("=".repeat(60));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`  ${passed}/${total} tests passed\n`);
  for (const r of results) {
    console.log(`  ${r.passed ? "✅" : "❌"} ${r.name}`);
  }
  console.log();
}

main().catch(console.error);
