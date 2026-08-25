import xlsx from "xlsx";
const wb = xlsx.readFile("data/raw/ParcelPilot_Assessment_Data.xlsx");
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: null });
  console.log(`Sheet "${name}": ${rows.length} data rows`);
  if (name === "README") {
    rows.slice(0, 8).forEach(r => console.log("  ", JSON.stringify(r)));
  }
  if (name === "tickets") {
    const withRes = rows.filter(r => r.historical_resolution);
    console.log(`  Tickets with historical_resolution: ${withRes.length}`);
    if (withRes.length > 0) console.log("  Sample:", JSON.stringify(withRes[0]));
  }
  if (name === "orders") {
    const statuses = [...new Set(rows.map(r => r.status))];
    console.log("  Order statuses:", statuses);
    const carriers = [...new Set(rows.map(r => r.carrier))];
    console.log("  Carriers:", carriers);
  }
  if (name === "accounts") {
    console.log("  Accounts:", rows.map(r => ({ id: r.account_id, name: r.account_name, plan: r.plan })));
  }
}
