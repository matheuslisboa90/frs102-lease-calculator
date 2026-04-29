import { useState, useMemo, useRef } from "react";

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const G = {
  red: "#CC0000", darkRed: "#A30000", lightRed: "#fff0f0", borderRed: "#ffcccc",
  dark: "#1a1a1a", mid: "#555", light: "#888", lighter: "#bbb", border: "#e0e0e0",
  bg: "#f5f5f5", white: "#ffffff", font: "'Arial', sans-serif", fontSize: "12px",
};
const css = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${G.font}; font-size: ${G.fontSize}; background: ${G.bg}; color: ${G.dark}; }
  input, select, textarea, button { font-family: ${G.font}; font-size: ${G.fontSize}; }
  input:focus, select:focus, textarea:focus { outline: 2px solid ${G.red}; outline-offset: -1px; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #f0f0f0; }
  ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; }
  th { font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: ${G.light}; padding: 9px 12px; text-align: left; background: #fafafa; border-bottom: 2px solid #f0f0f0; white-space: nowrap; }
  td { padding: 8px 12px; border-bottom: 1px solid #f7f7f7; color: ${G.mid}; vertical-align: middle; }
  tr:hover td { background: #fafafa; }
`;

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────
const SUPER_ADMIN = { id: "sa", username: "superadmin", password: "Affinity2024!", role: "SuperAdmin", name: "Affinity Core Admin", email: "admin@affinitycoreservices.com" };

const initClients = [
  { id: "c1", companyName: "Demo Ltd", address: "1 High Street, London, EC1A 1BB", phone: "020 7000 0001", mainContact: "Sarah Jones", contactRole: "Finance Director", companiesHouse: "12345678", email: "sarah@demolink.com", yearEnd: "2026-12-31", active: true, registeredDate: "2024-01-15" },
];

const initUsers = [
  { id: "u1", clientId: "c1", username: "demo_admin", password: "demo123", role: "Admin", name: "Sarah Jones", email: "sarah@demolink.com", active: true },
  { id: "u2", clientId: "c1", username: "demo_view", password: "view123", role: "Viewer", name: "Tom Brown", email: "tom@demolink.com", active: true },
];

const initLeases = [
  { id: "l1", clientId: "c1", name: "Head Office — 12 King St", type: "Property", description: "Main office lease", commencementDate: "2026-01-01", leaseTerm: "5", annualPayment: "48000", interestRate: "5.5", ibrRationale: "Based on company's incremental borrowing rate from Barclays facility letter dated 01/01/2026", paymentFrequency: "Monthly", residualValue: "0", status: "Active", agreementFile: null, ibrEvidence: null, comments: "", payments: [] },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) => n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(n);
const fmtN = (n) => n == null ? "—" : new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const today = () => new Date().toISOString().split("T")[0];
const genId = () => Math.random().toString(36).substr(2, 9);

function calcLease(lease) {
  const r = parseFloat(lease.interestRate) / 100;
  const n = parseInt(lease.leaseTerm);
  const pmt = parseFloat(lease.annualPayment);
  const rv = parseFloat(lease.residualValue) || 0;
  if (!r || !n || !pmt) return null;
  const periodsPerYear = lease.paymentFrequency === "Monthly" ? 12 : lease.paymentFrequency === "Quarterly" ? 4 : 1;
  const periodicRate = r / periodsPerYear;
  const totalPeriods = n * periodsPerYear;
  const periodicPayment = pmt / periodsPerYear;
  const pvPayments = periodicPayment * ((1 - Math.pow(1 + periodicRate, -totalPeriods)) / periodicRate);
  const pvResidual = rv / Math.pow(1 + periodicRate, totalPeriods);
  const rouAsset = pvPayments + pvResidual;
  const annualDepreciation = (rouAsset - rv) / n;
  let balance = rouAsset;
  const schedule = [];
  for (let year = 1; year <= n; year++) {
    const startDate = new Date(lease.commencementDate);
    startDate.setFullYear(startDate.getFullYear() + year - 1);
    const endDate = new Date(lease.commencementDate);
    endDate.setFullYear(endDate.getFullYear() + year);
    const interestCharge = balance * r;
    const repayment = pmt - interestCharge;
    const closingBalance = Math.max(0, balance - repayment);
    schedule.push({
      year, period: `Year ${year}`,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      openingBalance: balance, annualPayment: pmt, interestCharge,
      repayment, closingBalance,
      depreciation: annualDepreciation,
      rouCarrying: Math.max(0, rouAsset - annualDepreciation * year),
      totalExpense: interestCharge + annualDepreciation,
    });
    balance = closingBalance;
  }
  return { rouAsset, liabilityOpening: rouAsset, totalPayments: pmt * n, totalInterest: pmt * n - rouAsset, schedule };
}

function getYTDMTD(lease, calc, asOfDate) {
  if (!calc || !asOfDate) return { ytdInterest: 0, ytdDepreciation: 0, ytdLiabilityMovement: 0, mtdInterest: 0, mtdDepreciation: 0 };
  const start = new Date(lease.commencementDate);
  const asOf = new Date(asOfDate);
  const yearStart = new Date(asOf.getFullYear(), 0, 1);
  const monthStart = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  let ytdInterest = 0, ytdDepreciation = 0, ytdLiabilityMovement = 0, mtdInterest = 0, mtdDepreciation = 0;
  calc.schedule.forEach(s => {
    const sStart = new Date(s.startDate);
    const sEnd = new Date(s.endDate);
    const dailyInterest = s.interestCharge / 365;
    const dailyDeprec = s.depreciation / 365;
    // YTD
    const ytdFrom = sStart < yearStart ? yearStart : sStart;
    const ytdTo = sEnd > asOf ? asOf : sEnd;
    if (ytdTo > ytdFrom) {
      const days = (ytdTo - ytdFrom) / 86400000;
      ytdInterest += dailyInterest * days;
      ytdDepreciation += dailyDeprec * days;
    }
    // MTD
    const mtdFrom = sStart < monthStart ? monthStart : sStart;
    const mtdTo = sEnd > asOf ? asOf : sEnd;
    if (mtdTo > mtdFrom) {
      const days = (mtdTo - mtdFrom) / 86400000;
      mtdInterest += dailyInterest * days;
      mtdDepreciation += dailyDeprec * days;
    }
  });
  return { ytdInterest, ytdDepreciation, mtdInterest, mtdDepreciation };
}

function exportXLS(filename, headers, rows) {
  const esc = v => v == null ? "" : String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const headerRow = headers.map(h => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join("");
  const dataRows = rows.map(row => `<Row>${row.map(c => `<Cell ss:StyleID="${typeof c === "number" ? "n" : "d"}"><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${esc(typeof c === "number" ? c.toFixed(2) : c)}</Data></Cell>`).join("")}</Row>`).join("");
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#CC0000" ss:Pattern="Solid"/></Style><Style ss:ID="d"/><Style ss:ID="n"><NumberFormat ss:Format="#,##0.00"/></Style></Styles><Worksheet ss:Name="Report"><Table><Row>${headerRow}</Row>${dataRows}</Table></Worksheet></Workbook>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([xml], { type: "application/vnd.ms-excel" }));
  a.download = filename + ".xls"; a.click();
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
const Btn = ({ onClick, children, variant = "primary", size = "md", disabled, style: s }) => {
  const base = { border: "none", borderRadius: 2, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 700, letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1, transition: "all 0.15s", ...s };
  const variants = {
    primary: { background: G.red, color: "#fff", padding: size === "sm" ? "5px 12px" : "9px 18px" },
    secondary: { background: G.dark, color: "#fff", padding: size === "sm" ? "5px 12px" : "9px 18px" },
    outline: { background: "none", color: G.mid, border: `1.5px solid ${G.border}`, padding: size === "sm" ? "4px 10px" : "8px 16px" },
    danger: { background: "#fff0f0", color: G.red, border: `1px solid ${G.borderRed}`, padding: size === "sm" ? "4px 10px" : "8px 16px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
};

const Field = ({ label, children, required, hint }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: G.light }}>{label}{required && <span style={{ color: G.red }}> *</span>}</label>
    {children}
    {hint && <div style={{ fontSize: 10, color: G.lighter, lineHeight: 1.4 }}>{hint}</div>}
  </div>
);

const Input = ({ value, onChange, type = "text", placeholder, min, required, style: s }) => (
  <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} required={required}
    style={{ border: `1.5px solid ${G.border}`, borderRadius: 2, padding: "7px 10px", fontSize: 12, width: "100%", background: "#fff", ...s }} />
);

const Select = ({ value, onChange, options, style: s }) => (
  <select value={value || ""} onChange={e => onChange(e.target.value)}
    style={{ border: `1.5px solid ${G.border}`, borderRadius: 2, padding: "7px 10px", fontSize: 12, width: "100%", background: "#fff", ...s }}>
    {options.map(o => typeof o === "string" ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Textarea = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ border: `1.5px solid ${G.border}`, borderRadius: 2, padding: "7px 10px", fontSize: 12, width: "100%", background: "#fff", resize: "vertical" }} />
);

const Badge = ({ label, color = "gray" }) => {
  const colors = { red: { bg: "#fff0f0", text: G.red }, green: { bg: "#f0fff4", text: "#2d7a2d" }, gray: { bg: "#f5f5f5", text: G.light }, blue: { bg: "#f0f4ff", text: "#4466cc" } };
  return <span style={{ background: colors[color].bg, color: colors[color].text, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{label}</span>;
};

const Card = ({ children, style: s, title, action }) => (
  <div style={{ background: G.white, border: `1px solid ${G.border}`, borderRadius: 2, ...s }}>
    {title && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${G.border}` }}>
      <div style={{ fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 3, height: 14, background: G.red, display: "inline-block", borderRadius: 1 }}></span>{title}
      </div>
      {action}
    </div>}
    <div style={{ padding: title ? "16px 18px" : 0 }}>{children}</div>
  </div>
);

const StatCard = ({ label, value, sub }) => (
  <div style={{ background: G.white, border: `1px solid ${G.border}`, borderLeft: `3px solid ${G.red}`, borderRadius: 2, padding: "14px 18px" }}>
    <div style={{ fontSize: 10, color: G.light, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: G.dark }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: G.lighter, marginTop: 3 }}>{sub}</div>}
  </div>
);

const Modal = ({ title, onClose, children, width = 600 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div style={{ background: G.white, borderRadius: 2, width, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `2px solid ${G.red}`, background: G.red }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{title}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  </div>
);

// ─── ICONS ────────────────────────────────────────────────────────────────────
const I = ({ n, s = 14 }) => {
  const d = {
    dashboard: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
    lease: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zm-4 0v6h6M8 13h8M8 17h8M8 9h2",
    reports: "M18 20V10M12 20V4M6 20v-6",
    users: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
    download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
    plus: "M12 5v14M5 12h14",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
    trash: "M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6",
    edit: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
    company: "M3 21h18M3 7v14M21 7v14M6 21V3h12v18M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2",
    calc: "M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zM8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h2M14 18h2",
    key: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    disclosure: "M9 12h6M9 16h4M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z",
    payment: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    attach: "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48",
  };
  return <svg width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={d[n] || ""}/></svg>;
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [show, setShow] = useState(false);
  const handle = (users, clients) => {
    if (u === SUPER_ADMIN.username && p === SUPER_ADMIN.password) { onLogin(SUPER_ADMIN, null); return; }
    const user = users.find(x => x.username === u && x.password === p && x.active);
    if (user) { const client = clients.find(c => c.id === user.clientId); onLogin(user, client); }
    else setErr("Invalid credentials or account inactive.");
  };
  return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: G.white, width: 400, borderRadius: 2, boxShadow: "0 4px 30px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        <div style={{ background: G.red, padding: "32px 36px 24px", textAlign: "center" }}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>FRS 102 — Section 20</div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Lease Manager</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 4 }}>Affinity Core Services</div>
        </div>
        <div style={{ padding: "28px 36px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Username">
            <Input value={u} onChange={setU} placeholder="Enter username" />
          </Field>
          <Field label="Password">
            <div style={{ position: "relative" }}>
              <Input value={p} onChange={setP} type={show ? "text" : "password"} placeholder="Enter password" />
              <button onClick={() => setShow(!show)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: G.light }}><I n="eye" /></button>
            </div>
          </Field>
          {err && <div style={{ background: G.lightRed, border: `1px solid ${G.borderRed}`, color: G.red, padding: "8px 12px", borderRadius: 2, fontSize: 11 }}>{err}</div>}
          <LoginWrapper onLogin={handle} />
        </div>
      </div>
    </div>
  );
}

function LoginWrapper({ onLogin }) {
  const [users] = useState(initUsers);
  const [clients] = useState(initClients);
  return <Btn onClick={() => onLogin(users, clients)}>Sign In</Btn>;
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, user, client, onLogout }) {
  const isSA = user.role === "SuperAdmin";
  const isAdmin = user.role === "Admin" || isSA;
  const navItems = isSA
    ? [{ id: "sa-dashboard", label: "Super Dashboard", icon: "shield" }, { id: "sa-clients", label: "Client Management", icon: "company" }, { id: "sa-users", label: "All Users", icon: "users" }]
    : [
        { id: "dashboard", label: "Dashboard", icon: "dashboard" },
        { id: "company", label: "Company Profile", icon: "company" },
        { id: "leases", label: "Lease Register", icon: "lease" },
        { id: "calculator", label: "Calculator", icon: "calc" },
        { id: "reports", label: "Reports", icon: "reports" },
        { id: "disclosure", label: "FRS 102 Disclosures", icon: "disclosure" },
        ...(isAdmin ? [{ id: "users", label: "Users", icon: "users" }] : []),
      ];

  return (
    <div style={{ width: 210, background: G.dark, minHeight: "100vh", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #2e2e2e" }}>
        <div style={{ color: G.red, fontSize: 9, letterSpacing: 3, textTransform: "uppercase", marginBottom: 3 }}>FRS 102</div>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Lease Manager</div>
        {client && <div style={{ color: G.lighter, fontSize: 10, marginTop: 6, borderTop: "1px solid #2e2e2e", paddingTop: 6 }}>{client.companyName}</div>}
      </div>
      <nav style={{ flex: 1, padding: "10px 0" }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 16px", background: active === item.id ? G.red : "none", border: "none", color: active === item.id ? "#fff" : "#777", cursor: "pointer", fontSize: 12, textAlign: "left", transition: "all 0.12s" }}>
            <I n={item.icon} s={13} />{item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "14px 16px", borderTop: "1px solid #2e2e2e" }}>
        <div style={{ color: "#fff", fontSize: 12, marginBottom: 1 }}>{user.name}</div>
        <div style={{ color: G.red, fontSize: 10, marginBottom: 10 }}>{user.role}</div>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 6, color: "#666", background: "none", border: "none", cursor: "pointer", fontSize: 11 }}><I n="logout" s={12} /> Sign Out</button>
      </div>
    </div>
  );
}

// ─── SUPER ADMIN SCREENS ──────────────────────────────────────────────────────
function SADashboard({ clients, users, leases }) {
  const totalLeases = leases.length;
  const totalClients = clients.filter(c => c.active).length;
  let totalROU = 0;
  leases.forEach(l => { const c = calcLease(l); if (c) totalROU += c.rouAsset; });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div><div style={{ fontSize: 18, fontWeight: 700 }}>Super Admin Dashboard</div><div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>Affinity Core Services — System Overview</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <StatCard label="Active Clients" value={totalClients} />
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Total Leases" value={totalLeases} />
        <StatCard label="Total ROU Assets" value={fmt(totalROU)} />
      </div>
      <Card title="Recent Clients">
        <table>
          <thead><tr><th>Company</th><th>Main Contact</th><th>Year End</th><th>Leases</th><th>Status</th></tr></thead>
          <tbody>{clients.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 700 }}>{c.companyName}</td>
              <td>{c.mainContact}</td>
              <td>{c.yearEnd}</td>
              <td>{leases.filter(l => l.clientId === c.id).length}</td>
              <td><Badge label={c.active ? "Active" : "Inactive"} color={c.active ? "green" : "gray"} /></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

function SAClients({ clients, setClients, users, setUsers, leases }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openNew = () => { setForm({ active: true, yearEnd: "2026-12-31" }); setModal("new"); };
  const openEdit = (c) => { setForm({ ...c }); setModal("edit"); };
  const openUsers = (c) => { setForm({ clientId: c.id, clientName: c.companyName }); setModal("users"); };

  const saveClient = () => {
    if (!form.companyName) return alert("Company name required");
    if (modal === "new") {
      const newClient = { ...form, id: genId(), registeredDate: today() };
      setClients(cs => [...cs, newClient]);
      // auto-create admin user
      const tempPass = "Welcome" + Math.floor(1000 + Math.random() * 9000) + "!";
      setUsers(us => [...us, { id: genId(), clientId: newClient.id, username: form.companyName.toLowerCase().replace(/\s+/g, "_").substring(0, 12) + "_admin", password: tempPass, role: "Admin", name: form.mainContact || "Admin", email: form.email || "", active: true }]);
      alert(`Client created!\n\nAuto-generated Admin login:\nUsername: ${form.companyName.toLowerCase().replace(/\s+/g, "_").substring(0, 12)}_admin\nPassword: ${tempPass}\n\nPlease share these credentials securely with the client.`);
    } else {
      setClients(cs => cs.map(c => c.id === form.id ? form : c));
    }
    setModal(null);
  };

  const clientUsers = modal === "users" ? users.filter(u => u.clientId === form.clientId) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><div style={{ fontSize: 18, fontWeight: 700 }}>Client Management</div><div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>Full control over all client accounts</div></div>
        <Btn onClick={openNew}><I n="plus" s={13} /> Add Client</Btn>
      </div>
      <Card>
        <div style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Company</th><th>Companies House</th><th>Main Contact</th><th>Year End</th><th>Users</th><th>Leases</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{clients.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 700 }}>{c.companyName}</td>
                <td>{c.companiesHouse}</td>
                <td>{c.mainContact}<br /><span style={{ fontSize: 10, color: G.light }}>{c.email}</span></td>
                <td>{c.yearEnd}</td>
                <td>{users.filter(u => u.clientId === c.id).length}</td>
                <td>{leases.filter(l => l.clientId === c.id).length}</td>
                <td><Badge label={c.active ? "Active" : "Inactive"} color={c.active ? "green" : "gray"} /></td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn size="sm" variant="outline" onClick={() => openEdit(c)}><I n="edit" s={12} /></Btn>
                    <Btn size="sm" variant="outline" onClick={() => openUsers(c)}><I n="users" s={12} /></Btn>
                    <Btn size="sm" variant="danger" onClick={() => setClients(cs => cs.map(x => x.id === c.id ? { ...x, active: !x.active } : x))}>
                      {c.active ? "Deactivate" : "Activate"}
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      {(modal === "new" || modal === "edit") && (
        <Modal title={modal === "new" ? "Add New Client" : "Edit Client"} onClose={() => setModal(null)} width={680}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Entity / Company Name" required><Input value={form.companyName} onChange={v => set("companyName", v)} /></Field>
            <Field label="Companies House Number"><Input value={form.companiesHouse} onChange={v => set("companiesHouse", v)} /></Field>
            <Field label="Address" required><Input value={form.address} onChange={v => set("address", v)} /></Field>
            <Field label="Contact Number"><Input value={form.phone} onChange={v => set("phone", v)} /></Field>
            <Field label="Main Contact Name" required><Input value={form.mainContact} onChange={v => set("mainContact", v)} /></Field>
            <Field label="Contact Role"><Input value={form.contactRole} onChange={v => set("contactRole", v)} /></Field>
            <Field label="Email"><Input value={form.email} onChange={v => set("email", v)} type="email" /></Field>
            <Field label="Year End" required hint="FRS 102 lease changes apply from YE 31/12/2026 onwards"><Input value={form.yearEnd} onChange={v => set("yearEnd", v)} type="date" /></Field>
            <Field label="Status"><Select value={form.active ? "Active" : "Inactive"} onChange={v => set("active", v === "Active")} options={["Active", "Inactive"]} /></Field>
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <Btn onClick={saveClient}>{modal === "new" ? "Create Client" : "Save Changes"}</Btn>
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
          </div>
          {modal === "new" && <div style={{ marginTop: 14, padding: 12, background: G.lightRed, border: `1px solid ${G.borderRed}`, borderRadius: 2, fontSize: 11, color: G.mid, lineHeight: 1.6 }}>
            <strong style={{ color: G.red }}>Note:</strong> An admin username and temporary password will be automatically generated for this client. You will see the credentials on save — please share them securely.
          </div>}
        </Modal>
      )}

      {modal === "users" && (
        <Modal title={`Users — ${form.clientName}`} onClose={() => setModal(null)} width={700}>
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{clientUsers.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700 }}>{u.name}</td>
                <td style={{ fontFamily: "monospace" }}>{u.username}</td>
                <td><Badge label={u.role} color={u.role === "Admin" ? "red" : "gray"} /></td>
                <td>{u.email}</td>
                <td><Badge label={u.active ? "Active" : "Inactive"} color={u.active ? "green" : "gray"} /></td>
                <td>
                  <Btn size="sm" variant="danger" onClick={() => setUsers(us => us.map(x => x.id === u.id ? { ...x, active: !x.active } : x))}>
                    {u.active ? "Deactivate" : "Activate"}
                  </Btn>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {clientUsers.length === 0 && <div style={{ padding: 20, textAlign: "center", color: G.lighter }}>No users for this client.</div>}
        </Modal>
      )}
    </div>
  );
}

function SAUsers({ users, setUsers, clients }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div><div style={{ fontSize: 18, fontWeight: 700 }}>All Users</div><div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>System-wide user overview</div></div>
      <Card>
        <div style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Client</th><th>Role</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{users.map(u => {
              const client = clients.find(c => c.id === u.clientId);
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td>
                  <td style={{ fontFamily: "monospace" }}>{u.username}</td>
                  <td>{client?.companyName || "—"}</td>
                  <td><Badge label={u.role} color={u.role === "Admin" ? "red" : "gray"} /></td>
                  <td>{u.email}</td>
                  <td><Badge label={u.active ? "Active" : "Inactive"} color={u.active ? "green" : "gray"} /></td>
                  <td>
                    <Btn size="sm" variant="danger" onClick={() => setUsers(us => us.map(x => x.id === u.id ? { ...x, active: !x.active } : x))}>
                      {u.active ? "Deactivate" : "Activate"}
                    </Btn>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── CLIENT SCREENS ───────────────────────────────────────────────────────────
function CompanyProfile({ client, setClients, user }) {
  const [form, setForm] = useState({ ...client });
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const canEdit = user.role === "Admin";

  const save = () => {
    setClients(cs => cs.map(c => c.id === client.id ? form : c));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const frs102Impact = client.yearEnd >= "2026-12-31";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div><div style={{ fontSize: 18, fontWeight: 700 }}>Company Profile</div><div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>Entity registration details</div></div>
      <div style={{ background: frs102Impact ? "#fff8f0" : G.lightRed, border: `1px solid ${frs102Impact ? "#ffcc88" : G.borderRed}`, borderRadius: 2, padding: "12px 16px", fontSize: 11, lineHeight: 1.6 }}>
        <strong style={{ color: frs102Impact ? "#cc6600" : G.red }}>FRS 102 Lease Changes:</strong>{" "}
        {frs102Impact
          ? `This entity has a year end of ${client.yearEnd} and IS impacted by the FRS 102 Section 20 lease changes effective for periods beginning on or after 1 January 2026.`
          : `This entity's year end does not yet fall within the FRS 102 lease changes scope. Changes apply to accounting periods beginning on or after 1 January 2026.`}
      </div>
      <Card title="Registered Entity Details">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Entity / Company Name" required><Input value={form.companyName} onChange={v => set("companyName", v)} style={{ fontWeight: 700 }} /></Field>
          <Field label="Companies House Number"><Input value={form.companiesHouse} onChange={v => set("companiesHouse", v)} /></Field>
          <Field label="Registered Address"><Input value={form.address} onChange={v => set("address", v)} /></Field>
          <Field label="Contact Number"><Input value={form.phone} onChange={v => set("phone", v)} /></Field>
          <Field label="Main Contact Name"><Input value={form.mainContact} onChange={v => set("mainContact", v)} /></Field>
          <Field label="Contact Role / Title"><Input value={form.contactRole} onChange={v => set("contactRole", v)} /></Field>
          <Field label="Email Address"><Input value={form.email} onChange={v => set("email", v)} type="email" /></Field>
          <Field label="Year End" hint="FRS 102 lease changes apply to YE 31/12/2026 onwards"><Input value={form.yearEnd} onChange={v => set("yearEnd", v)} type="date" /></Field>
        </div>
        {canEdit && <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
          <Btn onClick={save}>Save Changes</Btn>
          {saved && <span style={{ color: "green", fontSize: 11 }}>✓ Saved successfully</span>}
        </div>}
      </Card>
    </div>
  );
}

function Dashboard({ leases, client }) {
  const [asOf, setAsOf] = useState(today());
  const [filter, setFilter] = useState("YTD");

  const clientLeases = leases.filter(l => l.clientId === client.id);

  const stats = useMemo(() => {
    let totalROU = 0, totalLiability = 0, totalInterest = 0;
    let ytdROU = 0, ytdLiability = 0, ytdInterest = 0;
    let mtdROU = 0, mtdLiability = 0, mtdInterest = 0;
    clientLeases.forEach(l => {
      const c = calcLease(l);
      if (!c) return;
      totalROU += c.rouAsset; totalLiability += c.liabilityOpening; totalInterest += c.totalInterest;
      const p = getYTDMTD(l, c, asOf);
      ytdROU += p.ytdDepreciation; ytdInterest += p.ytdInterest;
      mtdROU += p.mtdDepreciation; mtdInterest += p.mtdInterest;
    });
    return { totalROU, totalLiability, totalInterest, ytdROU, ytdInterest, mtdROU, mtdInterest };
  }, [clientLeases, asOf]);

  const displayed = filter === "YTD"
    ? { rou: stats.ytdROU, interest: stats.ytdInterest, label: `YTD to ${asOf}` }
    : { rou: stats.mtdROU, interest: stats.mtdInterest, label: `MTD to ${asOf}` };

  const frs102Impact = client.yearEnd >= "2026-12-31";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{client.companyName}</div>
          <div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>FRS 102 Section 20 — Lease Portfolio · Year End: {client.yearEnd}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 11, color: G.light }}>As of:</div>
          <Input value={asOf} onChange={setAsOf} type="date" style={{ width: 140 }} />
          <Select value={filter} onChange={setFilter} options={["YTD", "MTD"]} style={{ width: 80 }} />
        </div>
      </div>

      {frs102Impact && <div style={{ background: G.lightRed, border: `1px solid ${G.borderRed}`, borderRadius: 2, padding: "10px 14px", fontSize: 11, color: G.red }}>
        ⚠ This entity is impacted by FRS 102 Section 20 lease changes. Applicable for accounting periods beginning on or after 1 January 2026 (YE {client.yearEnd}).
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <StatCard label="Total ROU Assets" value={fmt(stats.totalROU)} sub="Initial recognition" />
        <StatCard label="Total Lease Liabilities" value={fmt(stats.totalLiability)} sub="Initial recognition" />
        <StatCard label="Total Finance Charges" value={fmt(stats.totalInterest)} sub="Over lease terms" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        <StatCard label={`ROU Depreciation — ${displayed.label}`} value={fmt(displayed.rou)} sub="Charged to P&L" />
        <StatCard label={`Finance Charges — ${displayed.label}`} value={fmt(displayed.interest)} sub="Charged to P&L" />
        <StatCard label="Active Leases" value={clientLeases.filter(l => l.status === "Active").length} sub={`of ${clientLeases.length} total`} />
      </div>

      <Card title="Lease Summary">
        <table>
          <thead><tr><th>Lease</th><th>Type</th><th>Start</th><th>Term</th><th>Annual Pmt</th><th>ROU Asset</th><th>Liability</th><th>Status</th></tr></thead>
          <tbody>{clientLeases.map(l => {
            const c = calcLease(l);
            return <tr key={l.id}>
              <td style={{ fontWeight: 700 }}>{l.name}</td>
              <td>{l.type}</td>
              <td>{l.commencementDate}</td>
              <td>{l.leaseTerm}y</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(l.annualPayment)}</td>
              <td style={{ color: G.red, fontVariantNumeric: "tabular-nums" }}>{c ? fmt(c.rouAsset) : "—"}</td>
              <td style={{ fontVariantNumeric: "tabular-nums" }}>{c ? fmt(c.liabilityOpening) : "—"}</td>
              <td><Badge label={l.status} color={l.status === "Active" ? "green" : "gray"} /></td>
            </tr>;
          })}</tbody>
        </table>
      </Card>
    </div>
  );
}

const LEASE_TYPES = ["Property", "Vehicle", "Equipment", "Plant & Machinery", "Other"];
const PAYMENT_FREQ = ["Monthly", "Quarterly", "Annual"];
const emptyLease = (clientId) => ({ clientId, name: "", type: "Property", description: "", commencementDate: "", leaseTerm: "", annualPayment: "", interestRate: "", ibrRationale: "", paymentFrequency: "Monthly", residualValue: "", status: "Active", agreementFile: null, ibrEvidence: null, comments: "", payments: [] });

function LeaseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState("basic");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const agreementRef = useRef(); const ibrRef = useRef();

  const handleFile = (key, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set(key, { name: file.name, size: file.size, data: reader.result });
    reader.readAsDataURL(file);
  };

  const tabs = [{ id: "basic", label: "Basic Details" }, { id: "financial", label: "Financial" }, { id: "payments", label: "Payments" }, { id: "documents", label: "Documents & Notes" }];

  return (
    <Card title={initial.id ? "Edit Lease" : "Add New Lease"}>
      <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: `1px solid ${G.border}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "8px 16px", background: "none", border: "none", borderBottom: tab === t.id ? `2px solid ${G.red}` : "2px solid transparent", color: tab === t.id ? G.red : G.light, cursor: "pointer", fontWeight: tab === t.id ? 700 : 400, fontSize: 11 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "basic" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Field label="Lease Name" required><Input value={form.name} onChange={v => set("name", v)} /></Field>
          <Field label="Asset Type"><Select value={form.type} onChange={v => set("type", v)} options={LEASE_TYPES} /></Field>
          <Field label="Status"><Select value={form.status} onChange={v => set("status", v)} options={["Active", "Terminated", "Renewed"]} /></Field>
          <Field label="Description" style={{ gridColumn: "1/-1" }}><Input value={form.description} onChange={v => set("description", v)} /></Field>
          <Field label="Commencement Date" required><Input value={form.commencementDate} onChange={v => set("commencementDate", v)} type="date" /></Field>
          <Field label="Lease Term (years)" required><Input value={form.leaseTerm} onChange={v => set("leaseTerm", v)} type="number" min="1" /></Field>
          <Field label="Payment Frequency"><Select value={form.paymentFrequency} onChange={v => set("paymentFrequency", v)} options={PAYMENT_FREQ} /></Field>
        </div>
      )}

      {tab === "financial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <Field label="Annual Payment (£)" required><Input value={form.annualPayment} onChange={v => set("annualPayment", v)} type="number" min="0" /></Field>
            <Field label="Incremental Borrowing Rate (%)" required hint="IBR used to discount future lease payments"><Input value={form.interestRate} onChange={v => set("interestRate", v)} type="number" min="0" /></Field>
            <Field label="Residual Value (£)"><Input value={form.residualValue} onChange={v => set("residualValue", v)} type="number" min="0" /></Field>
          </div>
          <Field label="IBR Rationale" hint="Explain why this rate was chosen (e.g. bank facility letter, market rate, etc.)">
            <Textarea value={form.ibrRationale} onChange={v => set("ibrRationale", v)} placeholder="e.g. Based on company's incremental borrowing rate from Barclays facility letter dated 01/01/2026, confirming a rate of 5.5% p.a." rows={4} />
          </Field>
          <Field label="Additional Comments">
            <Textarea value={form.comments} onChange={v => set("comments", v)} placeholder="Any additional notes about this lease..." rows={3} />
          </Field>
        </div>
      )}

      {tab === "payments" && (
        <div>
          <div style={{ marginBottom: 14, fontSize: 11, color: G.mid, lineHeight: 1.6, background: "#f9f9f9", padding: "10px 12px", borderRadius: 2 }}>
            Record actual payments made. The liability balance updates automatically based on scheduled vs actual payments.
          </div>
          <div style={{ marginBottom: 12 }}>
            <Btn size="sm" onClick={() => set("payments", [...(form.payments || []), { id: genId(), date: today(), amount: "", reference: "", notes: "" }])}>
              <I n="plus" s={12} /> Add Payment
            </Btn>
          </div>
          {(form.payments || []).length === 0
            ? <div style={{ textAlign: "center", padding: 24, color: G.lighter }}>No payments recorded yet.</div>
            : <table>
              <thead><tr><th>Date</th><th>Amount (£)</th><th>Reference</th><th>Notes</th><th></th></tr></thead>
              <tbody>{(form.payments || []).map((p, i) => (
                <tr key={p.id}>
                  <td><Input value={p.date} onChange={v => { const ps = [...form.payments]; ps[i] = { ...ps[i], date: v }; set("payments", ps); }} type="date" /></td>
                  <td><Input value={p.amount} onChange={v => { const ps = [...form.payments]; ps[i] = { ...ps[i], amount: v }; set("payments", ps); }} type="number" /></td>
                  <td><Input value={p.reference} onChange={v => { const ps = [...form.payments]; ps[i] = { ...ps[i], reference: v }; set("payments", ps); }} placeholder="Ref/Invoice" /></td>
                  <td><Input value={p.notes} onChange={v => { const ps = [...form.payments]; ps[i] = { ...ps[i], notes: v }; set("payments", ps); }} placeholder="Notes" /></td>
                  <td><Btn size="sm" variant="danger" onClick={() => set("payments", form.payments.filter((_, j) => j !== i))}><I n="trash" s={12} /></Btn></td>
                </tr>
              ))}</tbody>
            </table>}
          {(form.payments || []).length > 0 && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: G.lightRed, borderRadius: 2, fontSize: 11 }}>
              <strong>Total Paid:</strong> {fmt((form.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0))}
              &nbsp;·&nbsp;
              <strong>Scheduled Annual:</strong> {fmt(form.annualPayment)}
            </div>
          )}
        </div>
      )}

      {tab === "documents" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Lease Agreement" hint="Attach the signed lease agreement (PDF, Word, etc.)">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input ref={agreementRef} type="file" style={{ display: "none" }} onChange={e => handleFile("agreementFile", e)} accept=".pdf,.doc,.docx,.jpg,.png" />
              <Btn size="sm" variant="outline" onClick={() => agreementRef.current.click()}><I n="attach" s={12} /> {form.agreementFile ? "Replace File" : "Attach File"}</Btn>
              {form.agreementFile && <span style={{ fontSize: 11, color: G.mid }}>📎 {form.agreementFile.name} ({(form.agreementFile.size / 1024).toFixed(0)}KB)</span>}
            </div>
          </Field>
          <Field label="IBR Evidence" hint="Attach evidence supporting the incremental borrowing rate (e.g. bank letter, facility agreement)">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input ref={ibrRef} type="file" style={{ display: "none" }} onChange={e => handleFile("ibrEvidence", e)} accept=".pdf,.doc,.docx,.jpg,.png" />
              <Btn size="sm" variant="outline" onClick={() => ibrRef.current.click()}><I n="key" s={12} /> {form.ibrEvidence ? "Replace File" : "Attach Evidence"}</Btn>
              {form.ibrEvidence && <span style={{ fontSize: 11, color: G.mid }}>📎 {form.ibrEvidence.name} ({(form.ibrEvidence.size / 1024).toFixed(0)}KB)</span>}
            </div>
          </Field>
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <Btn onClick={() => { if (!form.name || !form.commencementDate || !form.leaseTerm || !form.annualPayment || !form.interestRate) { alert("Please complete all required fields in Basic Details and Financial tabs."); return; } onSave({ ...form, id: initial.id || genId() }); }}>
          {initial.id ? "Update Lease" : "Save Lease"}
        </Btn>
        <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
      </div>
    </Card>
  );
}

function LeasesPage({ leases, setLeases, client, user }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const canEdit = user.role !== "Viewer";
  const clientLeases = leases.filter(l => l.clientId === client.id);

  const save = (lease) => {
    setLeases(ls => editing ? ls.map(l => l.id === lease.id ? lease : l) : [...ls, lease]);
    setShowForm(false); setEditing(null);
  };

  if (viewing) {
    const c = calcLease(viewing);
    const totalPaid = (viewing.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const currentLiability = c ? Math.max(0, c.liabilityOpening - (totalPaid - c.totalInterest)) : 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button onClick={() => setViewing(null)} style={{ background: "none", border: "none", color: G.red, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>← Back to Leases</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{viewing.name}</div>
            <div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>{viewing.type} · {viewing.commencementDate} · {viewing.leaseTerm} years · {viewing.paymentFrequency}</div>
          </div>
          <Badge label={viewing.status} color={viewing.status === "Active" ? "green" : "gray"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          <StatCard label="ROU Asset" value={c ? fmt(c.rouAsset) : "—"} />
          <StatCard label="Initial Liability" value={c ? fmt(c.liabilityOpening) : "—"} />
          <StatCard label="Total Finance Charges" value={c ? fmt(c.totalInterest) : "—"} />
          <StatCard label="Total Paid to Date" value={fmt(totalPaid)} sub={`Adjusted liability: ${fmt(currentLiability)}`} />
        </div>
        {viewing.ibrRationale && <Card title="IBR Rationale">
          <div style={{ fontSize: 11, lineHeight: 1.7, color: G.mid }}>{viewing.ibrRationale}</div>
          {viewing.ibrEvidence && <div style={{ marginTop: 10 }}><span style={{ fontSize: 11, color: G.light }}>Evidence attached: </span><span style={{ fontSize: 11, color: G.red }}>📎 {viewing.ibrEvidence.name}</span></div>}
        </Card>}
        {viewing.agreementFile && <Card title="Lease Agreement"><span style={{ fontSize: 11, color: G.red }}>📎 {viewing.agreementFile.name}</span></Card>}
        {c && <Card title="Amortisation Schedule">
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Year</th><th>Period Start</th><th>Period End</th><th style={{ textAlign: "right" }}>Opening Balance</th><th style={{ textAlign: "right" }}>Annual Payment</th><th style={{ textAlign: "right" }}>Interest</th><th style={{ textAlign: "right" }}>Repayment</th><th style={{ textAlign: "right" }}>Closing Balance</th><th style={{ textAlign: "right" }}>Depreciation</th><th style={{ textAlign: "right" }}>ROU Carrying</th></tr></thead>
              <tbody>{c.schedule.map(r => (
                <tr key={r.year}>
                  <td style={{ fontWeight: 700, color: G.red }}>{r.period}</td>
                  <td>{r.startDate}</td><td>{r.endDate}</td>
                  {[r.openingBalance, r.annualPayment, r.interestCharge, r.repayment, r.closingBalance, r.depreciation, r.rouCarrying].map((v, i) =>
                    <td key={i} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>}
        {(viewing.payments || []).length > 0 && <Card title="Payment History">
          <table>
            <thead><tr><th>Date</th><th>Amount</th><th>Reference</th><th>Notes</th></tr></thead>
            <tbody>{viewing.payments.map(p => (
              <tr key={p.id}><td>{p.date}</td><td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(p.amount)}</td><td>{p.reference}</td><td>{p.notes}</td></tr>
            ))}</tbody>
          </table>
        </Card>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Lease Register</div>
          <div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>{client.companyName} · FRS 102 Section 20</div>
        </div>
        {canEdit && !showForm && !editing && <Btn onClick={() => { setShowForm(true); setEditing(null); }}><I n="plus" s={13} /> Add Lease</Btn>}
      </div>
      {(showForm || editing) && <LeaseForm initial={editing || emptyLease(client.id)} onSave={save} onCancel={() => { setShowForm(false); setEditing(null); }} />}
      <Card>
        <div style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Lease</th><th>Type</th><th>Start Date</th><th>Term</th><th>Annual Pmt</th><th>IBR %</th><th>ROU Asset</th><th>Liability</th><th>Paid</th><th>Agreement</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {clientLeases.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center", padding: 32, color: G.lighter }}>No leases added yet. Click "Add Lease" to begin.</td></tr>}
              {clientLeases.map(l => {
                const c = calcLease(l);
                const totalPaid = (l.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                return <tr key={l.id}>
                  <td style={{ fontWeight: 700 }}>{l.name}</td>
                  <td>{l.type}</td>
                  <td>{l.commencementDate}</td>
                  <td>{l.leaseTerm}y</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(l.annualPayment)}</td>
                  <td>{l.interestRate}%</td>
                  <td style={{ color: G.red, fontVariantNumeric: "tabular-nums" }}>{c ? fmt(c.rouAsset) : "—"}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{c ? fmt(c.liabilityOpening) : "—"}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{totalPaid > 0 ? fmt(totalPaid) : "—"}</td>
                  <td>{l.agreementFile ? <span title={l.agreementFile.name} style={{ color: G.red }}>📎</span> : "—"}</td>
                  <td><Badge label={l.status} color={l.status === "Active" ? "green" : "gray"} /></td>
                  <td>
                    <div style={{ display: "flex", gap: 5 }}>
                      <Btn size="sm" variant="outline" onClick={() => setViewing(l)}><I n="eye" s={12} /></Btn>
                      {canEdit && <>
                        <Btn size="sm" variant="outline" onClick={() => { setEditing(l); setShowForm(false); }}><I n="edit" s={12} /></Btn>
                        <Btn size="sm" variant="danger" onClick={() => { if (confirm("Delete this lease?")) setLeases(ls => ls.filter(x => x.id !== l.id)); }}><I n="trash" s={12} /></Btn>
                      </>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Calculator() {
  const [form, setForm] = useState({ commencementDate: "", leaseTerm: "", annualPayment: "", interestRate: "", paymentFrequency: "Monthly", residualValue: "" });
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const calc = () => setResult(calcLease({ ...form, name: "", type: "", status: "", payments: [] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div><div style={{ fontSize: 18, fontWeight: 700 }}>Lease Calculator</div><div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>FRS 102 Section 20 — Quick Calculation Tool</div></div>
      <Card title="Lease Parameters">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 14 }}>
          <Field label="Commencement Date"><Input value={form.commencementDate} onChange={v => set("commencementDate", v)} type="date" /></Field>
          <Field label="Lease Term (years)"><Input value={form.leaseTerm} onChange={v => set("leaseTerm", v)} type="number" /></Field>
          <Field label="Payment Frequency"><Select value={form.paymentFrequency} onChange={v => set("paymentFrequency", v)} options={PAYMENT_FREQ} /></Field>
          <Field label="Annual Payment (£)"><Input value={form.annualPayment} onChange={v => set("annualPayment", v)} type="number" /></Field>
          <Field label="Incremental Borrowing Rate (%)"><Input value={form.interestRate} onChange={v => set("interestRate", v)} type="number" /></Field>
          <Field label="Residual Value (£)"><Input value={form.residualValue} onChange={v => set("residualValue", v)} type="number" /></Field>
        </div>
        <div style={{ background: G.lightRed, border: `1px solid ${G.borderRed}`, borderRadius: 2, padding: "10px 14px", fontSize: 11, color: G.mid, marginBottom: 14, lineHeight: 1.6 }}>
          <strong style={{ color: G.red }}>FRS 102 Note:</strong> Under Section 20, lessees recognise right-of-use assets and lease liabilities for all leases (subject to short-term and low-value exemptions). The incremental borrowing rate is used to discount future payments to present value.
        </div>
        <Btn onClick={calc}>Calculate</Btn>
      </Card>
      {result && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          <StatCard label="Right-of-Use Asset" value={fmt(result.rouAsset)} sub="Initial recognition — Balance Sheet" />
          <StatCard label="Lease Liability" value={fmt(result.liabilityOpening)} sub="Initial recognition — Balance Sheet" />
          <StatCard label="Total Finance Charges" value={fmt(result.totalInterest)} sub="Total P&L charge over term" />
        </div>
        <Card title="Amortisation Schedule" action={<Btn size="sm" variant="secondary" onClick={() => exportXLS("FRS102_Calculation", ["Year", "Opening Balance", "Annual Payment", "Interest", "Repayment", "Closing Balance", "Depreciation", "ROU Carrying"], result.schedule.map(r => [r.period, r.openingBalance, r.annualPayment, r.interestCharge, r.repayment, r.closingBalance, r.depreciation, r.rouCarrying]))}><I n="download" s={12} /> Export Excel</Btn>}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Year</th><th style={{ textAlign: "right" }}>Opening Balance</th><th style={{ textAlign: "right" }}>Annual Payment</th><th style={{ textAlign: "right" }}>Interest</th><th style={{ textAlign: "right" }}>Repayment</th><th style={{ textAlign: "right" }}>Closing Balance</th><th style={{ textAlign: "right" }}>Depreciation</th><th style={{ textAlign: "right" }}>ROU Carrying</th></tr></thead>
              <tbody>{result.schedule.map(r => (
                <tr key={r.year}>
                  <td style={{ fontWeight: 700, color: G.red }}>{r.period}</td>
                  {[r.openingBalance, r.annualPayment, r.interestCharge, r.repayment, r.closingBalance, r.depreciation, r.rouCarrying].map((v, i) =>
                    <td key={i} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      </>}
    </div>
  );
}

function Reports({ leases, client }) {
  const clientLeases = leases.filter(l => l.clientId === client.id);
  const [active, setActive] = useState("register");

  const reports = [
    { id: "register", label: "Lease Register" },
    { id: "liability", label: "Liability Schedule" },
    { id: "rou", label: "ROU Asset Schedule" },
    { id: "pl", label: "Annual P&L Charges" },
    { id: "payments", label: "Payment History" },
    { id: "disclosure", label: "Disclosure Summary" },
  ];

  const exportReport = () => {
    if (active === "register") {
      exportXLS(`${client.companyName}_Lease_Register`, ["Lease", "Type", "Start", "Term", "Annual Pmt", "IBR%", "Frequency", "Residual", "ROU Asset", "Liability", "Total Interest", "Total Paid", "Status"],
        clientLeases.map(l => { const c = calcLease(l); const paid = (l.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0); return [l.name, l.type, l.commencementDate, l.leaseTerm, parseFloat(l.annualPayment), parseFloat(l.interestRate), l.paymentFrequency, parseFloat(l.residualValue) || 0, c ? c.rouAsset : 0, c ? c.liabilityOpening : 0, c ? c.totalInterest : 0, paid, l.status]; }));
    } else if (active === "liability") {
      const rows = []; clientLeases.forEach(l => { const c = calcLease(l); if (c) c.schedule.forEach(s => rows.push([l.name, l.type, s.period, s.startDate, s.endDate, s.openingBalance, s.annualPayment, s.interestCharge, s.repayment, s.closingBalance])); });
      exportXLS(`${client.companyName}_Liability_Schedule`, ["Lease", "Type", "Period", "Start", "End", "Opening Balance", "Annual Payment", "Interest", "Repayment", "Closing Balance"], rows);
    } else if (active === "rou") {
      const rows = []; clientLeases.forEach(l => { const c = calcLease(l); if (c) c.schedule.forEach(s => rows.push([l.name, l.type, s.period, c.rouAsset, s.depreciation, s.rouCarrying])); });
      exportXLS(`${client.companyName}_ROU_Schedule`, ["Lease", "Type", "Period", "Cost", "Depreciation", "Carrying Value"], rows);
    } else if (active === "pl") {
      const rows = []; clientLeases.forEach(l => { const c = calcLease(l); if (c) c.schedule.forEach(s => rows.push([l.name, l.type, s.period, s.interestCharge, s.depreciation, s.totalExpense])); });
      exportXLS(`${client.companyName}_PL_Charges`, ["Lease", "Type", "Period", "Finance Charge", "Depreciation", "Total P&L"], rows);
    } else if (active === "payments") {
      const rows = []; clientLeases.forEach(l => (l.payments || []).forEach(p => rows.push([l.name, l.type, p.date, parseFloat(p.amount) || 0, p.reference || "", p.notes || ""])));
      exportXLS(`${client.companyName}_Payments`, ["Lease", "Type", "Date", "Amount", "Reference", "Notes"], rows);
    } else if (active === "disclosure") {
      let totalROU = 0, totalLiab = 0, totalInt = 0;
      const rows = clientLeases.map(l => { const c = calcLease(l); if (!c) return null; totalROU += c.rouAsset; totalLiab += c.liabilityOpening; totalInt += c.totalInterest; const end = new Date(l.commencementDate); end.setFullYear(end.getFullYear() + parseInt(l.leaseTerm)); return [l.name, l.type, l.commencementDate, end.toISOString().split("T")[0], l.leaseTerm, parseFloat(l.interestRate), c.rouAsset, c.liabilityOpening, c.totalInterest]; }).filter(Boolean);
      rows.push(["TOTAL", "", "", "", "", "", totalROU, totalLiab, totalInt]);
      exportXLS(`${client.companyName}_FRS102_Disclosure`, ["Lease", "Type", "Start", "End", "Term", "IBR%", "ROU Asset", "Lease Liability", "Total Finance Charges"], rows);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div><div style={{ fontSize: 18, fontWeight: 700 }}>Reports</div><div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>{client.companyName} · Export FRS 102 compliant reports</div></div>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ width: 180, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          {reports.map(r => (
            <button key={r.id} onClick={() => setActive(r.id)}
              style={{ textAlign: "left", padding: "9px 12px", background: active === r.id ? G.lightRed : "none", border: "none", borderLeft: `3px solid ${active === r.id ? G.red : "transparent"}`, color: active === r.id ? G.red : G.mid, cursor: "pointer", fontSize: 12, fontWeight: active === r.id ? 700 : 400, borderRadius: "0 2px 2px 0" }}>
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <Card title={reports.find(r => r.id === active)?.label} action={<Btn size="sm" variant="secondary" onClick={exportReport}><I n="download" s={12} /> Export to Excel</Btn>}>
            <div style={{ overflowX: "auto", fontSize: 11 }}>
              {clientLeases.length === 0
                ? <div style={{ textAlign: "center", padding: 32, color: G.lighter }}>No leases to report on.</div>
                : active === "register"
                  ? <table><thead><tr><th>Lease</th><th>Type</th><th>Start</th><th>Term</th><th style={{ textAlign: "right" }}>Annual Pmt</th><th style={{ textAlign: "right" }}>IBR%</th><th style={{ textAlign: "right" }}>ROU Asset</th><th style={{ textAlign: "right" }}>Liability</th><th>Status</th></tr></thead>
                    <tbody>{clientLeases.map(l => { const c = calcLease(l); return <tr key={l.id}><td style={{ fontWeight: 700 }}>{l.name}</td><td>{l.type}</td><td>{l.commencementDate}</td><td>{l.leaseTerm}y</td><td style={{ textAlign: "right" }}>{fmt(l.annualPayment)}</td><td style={{ textAlign: "right" }}>{l.interestRate}%</td><td style={{ textAlign: "right", color: G.red }}>{c ? fmt(c.rouAsset) : "—"}</td><td style={{ textAlign: "right" }}>{c ? fmt(c.liabilityOpening) : "—"}</td><td><Badge label={l.status} color={l.status === "Active" ? "green" : "gray"} /></td></tr>; })}</tbody></table>
                  : active === "pl"
                    ? <table><thead><tr><th>Lease</th><th>Year</th><th style={{ textAlign: "right" }}>Finance Charge</th><th style={{ textAlign: "right" }}>Depreciation</th><th style={{ textAlign: "right" }}>Total P&L</th></tr></thead>
                      <tbody>{clientLeases.flatMap(l => { const c = calcLease(l); if (!c) return []; return c.schedule.map(s => <tr key={`${l.id}-${s.year}`}><td style={{ fontWeight: 700 }}>{l.name}</td><td style={{ color: G.red }}>{s.period}</td><td style={{ textAlign: "right" }}>{fmt(s.interestCharge)}</td><td style={{ textAlign: "right" }}>{fmt(s.depreciation)}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(s.totalExpense)}</td></tr>); })}</tbody></table>
                    : <div style={{ color: G.lighter, textAlign: "center", padding: 32 }}>Click "Export to Excel" to generate this report.</div>
              }
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Disclosure({ leases, client }) {
  const clientLeases = leases.filter(l => l.clientId === client.id && l.status === "Active");
  let totalROU = 0, totalLiab = 0, totalInt = 0, totalDeprec = 0;
  const items = clientLeases.map(l => {
    const c = calcLease(l);
    if (!c) return null;
    totalROU += c.rouAsset; totalLiab += c.liabilityOpening; totalInt += c.totalInterest;
    totalDeprec += (c.rouAsset - (parseFloat(l.residualValue) || 0)) / parseInt(l.leaseTerm);
    return { lease: l, calc: c };
  }).filter(Boolean);

  const maturityBands = { lt1: 0, "1to5": 0, gt5: 0 };
  clientLeases.forEach(l => {
    const c = calcLease(l);
    if (!c) return;
    c.schedule.forEach(s => {
      if (s.year <= 1) maturityBands.lt1 += s.annualPayment;
      else if (s.year <= 5) maturityBands["1to5"] += s.annualPayment;
      else maturityBands.gt5 += s.annualPayment;
    });
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div><div style={{ fontSize: 18, fontWeight: 700 }}>FRS 102 Financial Statement Disclosures</div><div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>{client.companyName} · Section 20 — Leases</div></div>

      <Card title="Note X — Right-of-Use Assets">
        <table>
          <thead><tr><th>Asset</th><th style={{ textAlign: "right" }}>Cost</th><th style={{ textAlign: "right" }}>Annual Depreciation</th><th style={{ textAlign: "right" }}>Accumulated Depreciation</th><th style={{ textAlign: "right" }}>Carrying Value</th></tr></thead>
          <tbody>
            {items.map(({ lease: l, calc: c }) => {
              const annDeprec = (c.rouAsset - (parseFloat(l.residualValue) || 0)) / parseInt(l.leaseTerm);
              return <tr key={l.id}><td style={{ fontWeight: 700 }}>{l.name} <span style={{ fontWeight: 400, color: G.light }}>({l.type})</span></td>
                <td style={{ textAlign: "right" }}>{fmt(c.rouAsset)}</td>
                <td style={{ textAlign: "right" }}>{fmt(annDeprec)}</td>
                <td style={{ textAlign: "right" }}>{fmt(annDeprec)}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(c.rouAsset - annDeprec)}</td>
              </tr>;
            })}
            <tr style={{ background: "#fafafa", fontWeight: 700 }}>
              <td><strong>Total</strong></td>
              <td style={{ textAlign: "right" }}><strong>{fmt(totalROU)}</strong></td>
              <td style={{ textAlign: "right" }}><strong>{fmt(totalDeprec)}</strong></td>
              <td style={{ textAlign: "right" }}><strong>{fmt(totalDeprec)}</strong></td>
              <td style={{ textAlign: "right" }}><strong>{fmt(totalROU - totalDeprec)}</strong></td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Note Y — Lease Liabilities">
        <table>
          <thead><tr><th>Lease</th><th style={{ textAlign: "right" }}>Opening Liability</th><th style={{ textAlign: "right" }}>Finance Charge (Year 1)</th><th style={{ textAlign: "right" }}>Payment (Year 1)</th><th style={{ textAlign: "right" }}>Closing Liability (Year 1)</th></tr></thead>
          <tbody>
            {items.map(({ lease: l, calc: c }) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 700 }}>{l.name}</td>
                <td style={{ textAlign: "right" }}>{fmt(c.liabilityOpening)}</td>
                <td style={{ textAlign: "right" }}>{fmt(c.schedule[0]?.interestCharge)}</td>
                <td style={{ textAlign: "right" }}>{fmt(c.schedule[0]?.annualPayment)}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(c.schedule[0]?.closingBalance)}</td>
              </tr>
            ))}
            <tr style={{ background: "#fafafa", fontWeight: 700 }}>
              <td><strong>Total</strong></td>
              <td style={{ textAlign: "right" }}><strong>{fmt(totalLiab)}</strong></td>
              <td colSpan={2}></td>
              <td style={{ textAlign: "right" }}><strong>{fmt(items.reduce((s, { calc: c }) => s + (c.schedule[0]?.closingBalance || 0), 0))}</strong></td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Note Z — Maturity Analysis">
        <div style={{ fontSize: 11, color: G.mid, marginBottom: 12, lineHeight: 1.6 }}>
          The following table analyses the entity's lease liabilities into relevant maturity groupings based on the remaining period at the balance sheet date:
        </div>
        <table>
          <thead><tr><th>Maturity Band</th><th style={{ textAlign: "right" }}>Undiscounted Lease Payments</th></tr></thead>
          <tbody>
            <tr><td>Less than 1 year</td><td style={{ textAlign: "right" }}>{fmt(maturityBands.lt1)}</td></tr>
            <tr><td>Between 1 and 5 years</td><td style={{ textAlign: "right" }}>{fmt(maturityBands["1to5"])}</td></tr>
            <tr><td>More than 5 years</td><td style={{ textAlign: "right" }}>{fmt(maturityBands.gt5)}</td></tr>
            <tr style={{ background: "#fafafa", fontWeight: 700 }}><td><strong>Total</strong></td><td style={{ textAlign: "right" }}><strong>{fmt(maturityBands.lt1 + maturityBands["1to5"] + maturityBands.gt5)}</strong></td></tr>
          </tbody>
        </table>
      </Card>

      <Card title="Disclosure Narrative">
        <div style={{ fontSize: 11, lineHeight: 1.9, color: G.mid, display: "flex", flexDirection: "column", gap: 10 }}>
          <p><strong style={{ color: G.dark }}>Accounting Policy — Leases (FRS 102 Section 20)</strong></p>
          <p>The entity as lessee recognises right-of-use assets and corresponding lease liabilities in the balance sheet for all leases, except for short-term leases (lease term of 12 months or less) and leases of low-value assets. Lease payments associated with these exempt leases are recognised as an expense on a straight-line basis over the lease term.</p>
          <p>Right-of-use assets are measured at cost, which comprises the initial measurement of the corresponding lease liability, any lease payments made at or before the commencement date, less any lease incentives received, plus any initial direct costs incurred by the lessee.</p>
          <p>Lease liabilities are measured at the present value of the remaining lease payments, discounted using the entity's incremental borrowing rate at the commencement date ({items.length > 0 ? `ranging from ${Math.min(...clientLeases.map(l => parseFloat(l.interestRate) || 0)).toFixed(1)}% to ${Math.max(...clientLeases.map(l => parseFloat(l.interestRate) || 0)).toFixed(1)}%` : "applicable IBR"}).</p>
          <p>Total right-of-use assets at initial recognition: <strong>{fmt(totalROU)}</strong><br />Total lease liabilities at initial recognition: <strong>{fmt(totalLiab)}</strong><br />Total finance charges over lease terms: <strong>{fmt(totalInt)}</strong></p>
        </div>
      </Card>
    </div>
  );
}

function UsersPage({ users, setUsers, client, currentUser }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const clientUsers = users.filter(u => u.clientId === client.id);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.name || !form.username || !form.password) return alert("Please complete all fields.");
    setUsers(us => [...us, { ...form, id: genId(), clientId: client.id, active: true }]);
    setModal(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><div style={{ fontSize: 18, fontWeight: 700 }}>User Management</div><div style={{ fontSize: 11, color: G.light, marginTop: 2 }}>{client.companyName}</div></div>
        <Btn onClick={() => { setForm({ role: "Viewer" }); setModal(true); }}><I n="plus" s={13} /> Add User</Btn>
      </div>
      <Card>
        <div style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{clientUsers.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 700 }}>{u.name}</td>
                <td style={{ fontFamily: "monospace" }}>{u.username}</td>
                <td><Badge label={u.role} color={u.role === "Admin" ? "red" : "gray"} /></td>
                <td>{u.email}</td>
                <td><Badge label={u.active ? "Active" : "Inactive"} color={u.active ? "green" : "gray"} /></td>
                <td>
                  <Btn size="sm" variant="danger" onClick={() => setUsers(us => us.map(x => x.id === u.id ? { ...x, active: !x.active } : x))}>
                    {u.active ? "Deactivate" : "Activate"}
                  </Btn>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <div style={{ background: G.lightRed, border: `1px solid ${G.borderRed}`, borderRadius: 2, padding: "10px 14px", fontSize: 11, color: G.mid, lineHeight: 1.6 }}>
        <strong style={{ color: G.red }}>Role Permissions:</strong> Admin — full access (add/edit/delete leases, manage users, export) · Viewer — read-only access to leases and reports
      </div>
      {modal && (
        <Modal title="Add New User" onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Full Name" required><Input value={form.name} onChange={v => set("name", v)} /></Field>
            <Field label="Username" required hint="This will be used to log in"><Input value={form.username} onChange={v => set("username", v)} /></Field>
            <Field label="Password" required hint="Share this securely with the user"><Input value={form.password} onChange={v => set("password", v)} /></Field>
            <Field label="Email"><Input value={form.email} onChange={v => set("email", v)} type="email" /></Field>
            <Field label="Role"><Select value={form.role} onChange={v => set("role", v)} options={["Admin", "Viewer"]} /></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Btn onClick={save}>Add User</Btn>
              <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [active, setActive] = useState(null);
  const [clients, setClients] = useState(initClients);
  const [users, setUsers] = useState(initUsers);
  const [leases, setLeases] = useState(initLeases);

  const handleLogin = (u, c) => {
    setUser(u); setClient(c);
    setActive(u.role === "SuperAdmin" ? "sa-dashboard" : "dashboard");
  };

  const handleLogout = () => { setUser(null); setClient(null); setActive(null); };

  // Keep client in sync
  const currentClient = client ? clients.find(c => c.id === client.id) || client : null;

  if (!user) return (
    <>
      <style>{css}</style>
      <LoginWrapper2 onLogin={handleLogin} users={users} clients={clients} />
    </>
  );

  const isSA = user.role === "SuperAdmin";
  const pages = isSA
    ? { "sa-dashboard": <SADashboard clients={clients} users={users} leases={leases} />, "sa-clients": <SAClients clients={clients} setClients={setClients} users={users} setUsers={setUsers} leases={leases} />, "sa-users": <SAUsers users={users} setUsers={setUsers} clients={clients} /> }
    : { dashboard: <Dashboard leases={leases} client={currentClient} />, company: <CompanyProfile client={currentClient} setClients={setClients} user={user} />, leases: <LeasesPage leases={leases} setLeases={setLeases} client={currentClient} user={user} />, calculator: <Calculator />, reports: <Reports leases={leases} client={currentClient} />, disclosure: <Disclosure leases={leases} client={currentClient} />, users: <UsersPage users={users} setUsers={setUsers} client={currentClient} currentUser={user} /> };

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar active={active} setActive={setActive} user={user} client={currentClient} onLogout={handleLogout} />
        <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
          {pages[active] || null}
        </main>
      </div>
    </>
  );
}

function LoginWrapper2({ onLogin, users, clients }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [show, setShow] = useState(false);
  const handle = () => {
    if (u === SUPER_ADMIN.username && p === SUPER_ADMIN.password) { onLogin(SUPER_ADMIN, null); return; }
    const user = users.find(x => x.username === u && x.password === p && x.active);
    if (user) { const c = clients.find(x => x.id === user.clientId); onLogin(user, c); }
    else setErr("Invalid credentials or account inactive.");
  };
  return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: G.white, width: 400, borderRadius: 2, boxShadow: "0 4px 30px rgba(0,0,0,0.1)", overflow: "hidden" }}>
        <div style={{ background: G.red, padding: "32px 36px 24px", textAlign: "center" }}>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>FRS 102 — Section 20</div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Lease Manager</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 4 }}>Affinity Core Services</div>
        </div>
        <div style={{ padding: "28px 36px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Username"><Input value={u} onChange={setU} placeholder="Enter username" /></Field>
          <Field label="Password">
            <div style={{ position: "relative" }}>
              <Input value={p} onChange={setP} type={show ? "text" : "password"} placeholder="Enter password" />
              <button onClick={() => setShow(!show)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: G.light }}><I n="eye" /></button>
            </div>
          </Field>
          {err && <div style={{ background: G.lightRed, border: `1px solid ${G.borderRed}`, color: G.red, padding: "8px 12px", borderRadius: 2, fontSize: 11 }}>{err}</div>}
          <Btn onClick={handle}>Sign In</Btn>
          <div style={{ padding: "12px", background: G.bg, borderRadius: 2, fontSize: 10, color: G.lighter, lineHeight: 1.8 }}>
            <strong>Demo:</strong> admin / admin123 · demo_admin / demo123<br />
            <strong>Super Admin:</strong> superadmin / Affinity2024!
          </div>
        </div>
      </div>
    </div>
  );
}
