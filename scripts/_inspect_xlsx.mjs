import xlsx from "xlsx";
const wb = xlsx.readFile("data/raw/ParcelPilot_Assessment_Data.xlsx");
console.log("Sheet names:", wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  if (rows.length > 0) console.log("Header:", rows[0]);
  if (rows.length > 1) console.log("Row 1:", rows[1]);
  if (rows.length > 2) console.log("Row 2:", rows[2]);
}
