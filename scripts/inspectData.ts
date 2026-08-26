/**
 * Script to dump the ParcelPilot_Assessment_Data.xlsx contents for audit.
 */
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "../Support_FIles/ParcelPilot_Assessment_Data.xlsx");

const wb = XLSX.readFile(filePath);

console.log("\n=== SHEETS FOUND ===");
console.log(wb.SheetNames.join(", "));

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { defval: null });
  console.log(`\n\n====== SHEET: ${sheetName} (${data.length} rows) ======`);
  if (data.length > 0) {
    console.log("Columns:", Object.keys(data[0] as object).join(", "));
    console.log("First 5 rows:");
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
    if (data.length > 5) {
      console.log(`... and ${data.length - 5} more rows`);
    }
  }
}
