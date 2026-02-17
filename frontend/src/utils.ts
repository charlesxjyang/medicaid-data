export function fmtDollars(n: number): string {
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

export function fmtNumber(n: number): string {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtMonth(m: string): string {
  const [year, month] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(month) - 1]} ${year}`;
}

const EXCL_TYPES: Record<string, string> = {
  "1128a1": "Conviction — Program-Related",
  "1128a2": "Conviction — Patient Abuse",
  "1128a3": "Conviction — Felony Healthcare Fraud",
  "1128a4": "Conviction — Felony Controlled Substance",
  "1128Aa": "Conviction — Program-Related (Mandatory)",
  "1128b1": "Misconduct — License Revocation",
  "1128b2": "Misconduct — License Suspension",
  "1128b3": "Misconduct — Exclusion from State Program",
  "1128b4": "Misconduct — Excess Charges / Kickbacks",
  "1128b5": "Misconduct — Defaulted Health Ed Loan",
  "1128b6": "Misconduct — Controlled Substance",
  "1128b7": "Misconduct — Fraud / Kickbacks / Other",
  "1128b8": "Misconduct — Entity Controlled by Sanctioned Individual",
  "1128b11": "Misconduct — Healthcare Fraud (Non-Felony)",
  "1128b14": "Misconduct — Managed Care Fraud",
  "1128b16": "Misconduct — Obstruction of Investigation",
  "1156": "CMPs — Civil Monetary Penalties",
  "BRCH CIA": "Breach of CIA",
  "BRCH SA": "Breach of Settlement Agreement",
};

const EXCL_CITE: Record<string, string> = {
  "1128a1": "§1128(a)(1)", "1128a2": "§1128(a)(2)",
  "1128a3": "§1128(a)(3)", "1128a4": "§1128(a)(4)",
  "1128Aa": "§1128A(a)",
  "1128b1": "§1128(b)(1)", "1128b2": "§1128(b)(2)",
  "1128b3": "§1128(b)(3)", "1128b4": "§1128(b)(4)",
  "1128b5": "§1128(b)(5)", "1128b6": "§1128(b)(6)",
  "1128b7": "§1128(b)(7)", "1128b8": "§1128(b)(8)",
  "1128b11": "§1128(b)(11)", "1128b14": "§1128(b)(14)",
  "1128b16": "§1128(b)(16)",
  "1156": "§1156",
};

export function fmtExclType(code: string): string {
  const label = EXCL_TYPES[code];
  if (!label) return code;
  const cite = EXCL_CITE[code];
  return cite ? `${label} [${cite}]` : label;
}

export function fmtExclDate(d: string): string {
  if (!d || d.length !== 8) return d ?? "";
  const y = d.slice(0, 4);
  const m = parseInt(d.slice(4, 6));
  const day = parseInt(d.slice(6, 8));
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${day}, ${y}`;
}
