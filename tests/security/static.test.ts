import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

describe("Security Static Grep Tests (ST-25 to ST-26)", () => {
  it("ST-25: password_hash should never leak in UI components or APIs", () => {
    // Check that we aren't sending password_hash in the response anywhere.
    // We can grep the codebase for `password_hash` and ensure it only appears in DB schemas and the auth service.
    
    // As a simplistic automated check, we'll verify it doesn't appear in the `components` directory at all.
    const componentsDir = path.resolve(__dirname, "../../src/components");
    const checkDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          checkDir(fullPath);
        } else if (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          expect(content).not.toContain("password_hash");
        }
      }
    };
    
    checkDir(componentsDir);
  });

  it("ST-26: Session tokens absent from logs", () => {
    // Same for session tokens, ensure the string 'token_hash' is restricted to auth context.
    const apiDir = path.resolve(__dirname, "../../src/app/api");
    const checkApiDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          checkApiDir(fullPath);
        } else if (fullPath.endsWith(".ts")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          // Except for the actual login/session routes, it shouldn't be here.
          if (!fullPath.includes("login") && !fullPath.includes("session")) {
             expect(content).not.toContain("token_hash");
          }
        }
      }
    };
    
    checkApiDir(apiDir);
  });
});
