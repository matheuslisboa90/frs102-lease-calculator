import { useState, useMemo } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const USERS = [
  { id: 1, username: "admin", password: "admin123", role: "Admin", name: "Administrator" },
  { id: 2, username: "accountant", password: "acc123", role: "Accountant", name: "Jane Smith" },
  { id: 3, username: "viewer", password: "view123", role: "Viewer", name: "John Doe" },
];

const LEASE_TYPES = ["Property", "Vehicle", "Equipment", "Plant & Machinery", "Other"];
const PAYMENT_FREQ = ["Monthly", "Quarterly", "Annual"];

// ─── FRS 102 LEASE CALCULATIONS ──────────────────────────────────────────────
function calculateLease(lease) {
  const {
    commencementDate, leaseTerm, annualPayment, interestRate,
    paymentFrequency, residualValue = 0,
  } = lease;

  const r = parseFloat(interestRate) / 100;
  const n = parseInt(leaseTerm);
  const pmt = parseFloat(annualPayment);
  const rv = parseFloat(residualValue);

  if (!r || !n || !pmt) return null;

  const periodsPerYear = paymentFrequency === "Monthly" ? 12 : paymentFrequency === "Quarterly" ? 4 : 1;
  const periodicRate = r / periodsPerYear;
  const totalPeriods = n * periodsPerYear;
  const periodicPayment = pmt / periodsPerYear;

  // PV of lease payments (annuity)
  const pvPayments = periodicPayment * ((1 - Math.pow(1 + periodicRate, -totalPeriods)) / periodicRate);
  // PV of residual
  const pvResidual = rv / Math.pow(1 + periodicRate, totalPeriods);
  const rightOfUseAsset = pvPayments + pvResidual;
  const liabilityOpening = rightOfUseAsset;

  // Amortisation schedule
  const schedule = [];
  let balance = liabilityOpening;
  const annualDepreciation = (rightOfUseAsset - rv) / n;

  for (let year = 1; year <= n; year++) {
    const interestCharge = balance * r;
    const repayment = pmt - interestCharge;
    const closingBalance = balance - repayment;

    const startDate = new Date(commencementDate);
    startDate.setFullYear(startDate.getFullYear() + year - 1);
    const endDate = new Date(commencementDate);
    endDate.setFullYear(endDate.getFullYear() + year);

    schedule.push({
      year,
      period: `Year ${year}`,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      openingBalance: balance,
      annualPayment: pmt,
      interestCharge,
      repayment,
      closingBalance: Math.max(0, closingBalance),
      depreciation: annualDepreciation,
      rouAssetCarrying: Math.max(0, rightOfUseAsset - annualDepreciation * year),
      totalExpense: interestCharge + annualDepreciation,
    });

    balance = Math.max(0, closingBalance);
  }

  return {
    rightOfUseAsset,
    liabilityOpening,
    totalPayments: pmt * n,
    totalInterest: pmt * n - liabilityOpening,
    schedule,
  };
}

// ─── EXCEL EXPORT ────────────────────────────────────────────────────────────
function exportToExcel(data, filename, headers, rows) {
  const escapeXml = (v) => {
    if (v === null || v === undefined) return "";
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };
  const fmtNum = (v) => (typeof v === "number" ? v.toFixed(2) : v);

  const headerRow = headers.map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("");
  const dataRows = rows.map(row =>
    `<Row>${row.map(cell =>
      `<Cell ss:StyleID="${typeof cell === "number" ? "num" : "data"}"><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${escapeXml(typeof cell === "number" ? fmtNum(cell) : cell)}</Data></Cell>`
    ).join("")}</Row>`
  ).join("");

  const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#CC0000" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="data"><Alignment ss:Horizontal="Left"/></Style>
  <Style ss:ID="num"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0.00"/></Style>
 </Styles>
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename + ".xls"; a.click();
  URL.revokeObjectURL(url);
}

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 18 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    lease: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    reports: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    users: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    logout: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    download: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    plus: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    calc: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="14" y1="18" x2="16" y2="18"/></svg>,
    eye: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    trash: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
    lock: <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  };
  return icons[name] || null;
};

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const fmt = (n) => n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const fmtPct = (n) => n == null ? "—" : `${n}%`;

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [creds, setCreds] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  const handle = () => {
    const user = USERS.find(u => u.username === creds.username && u.password === creds.password);
    if (user) { setError(""); onLogin(user); }
    else setError("Invalid username or password.");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif" }}>
      <div style={{ background: "#fff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.10)", width: 420, overflow: "hidden" }}>
        <div style={{ background: "#CC0000", padding: "36px 40px 28px", textAlign: "center" }}>
          <div style={{ color: "#fff", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8, opacity: 0.85 }}>FRS 102</div>
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>Lease Calculator</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 6 }}>Section 20 — Leases</div>
        </div>
        <div style={{ padding: "32px 40px 36px" }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Username</label>
            <input value={creds.username} onChange={e => setCreds({ ...creds, username: e.target.value })}
              style={{ width: "100%", border: "1.5px solid #e0e0e0", borderRadius: 2, padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              placeholder="Enter username" onKeyDown={e => e.key === "Enter" && handle()} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "#888", textTransform: "uppercase", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative" }}>
              <input type={show ? "text" : "password"} value={creds.password} onChange={e => setCreds({ ...creds, password: e.target.value })}
                style={{ width: "100%", border: "1.5px solid #e0e0e0", borderRadius: 2, padding: "10px 40px 10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                placeholder="Enter password" onKeyDown={e => e.key === "Enter" && handle()} />
              <button onClick={() => setShow(!show)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>
                <Icon name="eye" size={16} />
              </button>
            </div>
          </div>
          {error && <div style={{ color: "#CC0000", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "#fff5f5", borderRadius: 2, border: "1px solid #ffcccc" }}>{error}</div>}
          <button onClick={handle} style={{ width: "100%", background: "#CC0000", color: "#fff", border: "none", borderRadius: 2, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginTop: 8, fontFamily: "inherit" }}>
            SIGN IN
          </button>
          <div style={{ marginTop: 20, padding: "14px", background: "#f9f9f9", borderRadius: 2, fontSize: 11, color: "#aaa", lineHeight: 1.7 }}>
            <strong style={{ color: "#bbb" }}>Demo accounts:</strong><br />
            admin / admin123 &nbsp;·&nbsp; accountant / acc123 &nbsp;·&nbsp; viewer / view123
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, user, onLogout }) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "leases", label: "Leases", icon: "lease" },
    { id: "calculator", label: "Calculator", icon: "calc" },
    { id: "reports", label: "Reports", icon: "reports" },
    ...(user.role === "Admin" ? [{ id: "users", label: "User Management", icon: "users" }] : []),
  ];

  return (
    <div style={{ width: 220, background: "#1a1a1a", minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Georgia', serif", flexShrink: 0 }}>
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid #2e2e2e" }}>
        <div style={{ color: "#CC0000", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>FRS 102</div>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Lease Manager</div>
      </div>
      <nav style={{ flex: 1, padding: "16px 0" }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", background: active === item.id ? "#CC0000" : "none", border: "none", color: active === item.id ? "#fff" : "#888", cursor: "pointer", fontSize: 13, fontFamily: "inherit", textAlign: "left", transition: "all 0.15s" }}>
            <Icon name={item.icon} size={16} />
            {item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: "16px 20px", borderTop: "1px solid #2e2e2e" }}>
        <div style={{ color: "#fff", fontSize: 13, marginBottom: 2 }}>{user.name}</div>
        <div style={{ color: "#CC0000", fontSize: 11, marginBottom: 12 }}>{user.role}</div>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 8, color: "#666", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
          <Icon name="logout" size={14} /> Sign Out
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2, padding: "20px 24px", borderLeft: accent ? "3px solid #CC0000" : "none" }}>
      <div style={{ fontSize: 11, color: "#aaa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Georgia', serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Dashboard({ leases }) {
  const stats = useMemo(() => {
    const total = leases.length;
    const active = leases.filter(l => l.status === "Active").length;
    let totalLiability = 0, totalROU = 0;
    leases.forEach(l => {
      const c = calculateLease(l);
      if (c) { totalLiability += c.liabilityOpening; totalROU += c.rightOfUseAsset; }
    });
    return { total, active, totalLiability, totalROU };
  }, [leases]);

  const upcoming = leases.filter(l => {
    const end = new Date(l.commencementDate);
    end.setFullYear(end.getFullYear() + parseInt(l.leaseTerm));
    const diff = (end - new Date()) / (1000 * 60 * 60 * 24 * 30);
    return diff > 0 && diff < 12;
  });

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Georgia', serif" }}>Dashboard</div>
        <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>FRS 102 Section 20 — Lease Portfolio Overview</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Leases" value={stats.total} sub="In portfolio" accent />
        <StatCard label="Active Leases" value={stats.active} sub="Currently running" accent />
        <StatCard label="Total ROU Assets" value={fmt(stats.totalROU)} sub="Right-of-use assets" accent />
        <StatCard label="Total Liabilities" value={fmt(stats.totalLiability)} sub="Lease liabilities" accent />
      </div>
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2, padding: "20px 24px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, background: "#CC0000", display: "inline-block", borderRadius: 1 }}></span>
          Leases Expiring Within 12 Months
        </div>
        {upcoming.length === 0
          ? <div style={{ color: "#aaa", fontSize: 13 }}>No leases expiring in the next 12 months.</div>
          : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: "2px solid #f0f0f0" }}>
              {["Lease Name", "Type", "Expiry Date"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#888", fontWeight: 600, fontSize: 11, letterSpacing: 1 }}>{h}</th>)}
            </tr></thead>
            <tbody>{upcoming.map(l => {
              const end = new Date(l.commencementDate);
              end.setFullYear(end.getFullYear() + parseInt(l.leaseTerm));
              return <tr key={l.id} style={{ borderBottom: "1px solid #f7f7f7" }}>
                <td style={{ padding: "9px 12px", color: "#CC0000", fontWeight: 600 }}>{l.name}</td>
                <td style={{ padding: "9px 12px", color: "#666" }}>{l.type}</td>
                <td style={{ padding: "9px 12px", color: "#444" }}>{end.toISOString().split("T")[0]}</td>
              </tr>;
            })}</tbody>
          </table>}
      </div>
    </div>
  );
}

const emptyLease = { name: "", type: "Property", description: "", commencementDate: "", leaseTerm: "", annualPayment: "", interestRate: "", paymentFrequency: "Monthly", residualValue: "", currency: "GBP", status: "Active" };

function LeaseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || emptyLease);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fieldStyle = { width: "100%", border: "1.5px solid #e0e0e0", borderRadius: 2, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#888", textTransform: "uppercase", marginBottom: 5 };

  const cols = (fields) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${fields.length}, 1fr)`, gap: 16 }}>
      {fields.map(({ label, key, type = "text", options, min }) => (
        <div key={key}>
          <label style={labelStyle}>{label}</label>
          {options
            ? <select value={form[key]} onChange={e => set(key, e.target.value)} style={fieldStyle}>
              {options.map(o => <option key={o}>{o}</option>)}
            </select>
            : <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} style={fieldStyle} min={min} />}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2, padding: "24px 28px" }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 22, color: "#1a1a1a" }}>{initial ? "Edit Lease" : "Add New Lease"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {cols([{ label: "Lease Name", key: "name" }, { label: "Asset Type", key: "type", options: LEASE_TYPES }, { label: "Status", key: "status", options: ["Active", "Terminated", "Renewed"] }])}
        <div>
          <label style={labelStyle}>Description</label>
          <input value={form.description} onChange={e => set("description", e.target.value)} style={fieldStyle} placeholder="Optional description" />
        </div>
        {cols([{ label: "Commencement Date", key: "commencementDate", type: "date" }, { label: "Lease Term (years)", key: "leaseTerm", type: "number", min: "1" }, { label: "Payment Frequency", key: "paymentFrequency", options: PAYMENT_FREQ }])}
        {cols([{ label: "Annual Payment (£)", key: "annualPayment", type: "number", min: "0" }, { label: "Interest Rate (%)", key: "interestRate", type: "number", min: "0" }, { label: "Residual Value (£)", key: "residualValue", type: "number", min: "0" }])}
        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
          <button onClick={() => { if (!form.name || !form.commencementDate || !form.leaseTerm || !form.annualPayment || !form.interestRate) return alert("Please fill all required fields."); onSave({ ...form, id: initial?.id || Date.now() }); }}
            style={{ background: "#CC0000", color: "#fff", border: "none", borderRadius: 2, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {initial ? "Update Lease" : "Save Lease"}
          </button>
          <button onClick={onCancel} style={{ background: "none", color: "#888", border: "1.5px solid #e0e0e0", borderRadius: 2, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function LeasesPage({ leases, setLeases, user }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const canEdit = user.role !== "Viewer";

  const save = (lease) => {
    setLeases(ls => editing ? ls.map(l => l.id === lease.id ? lease : l) : [...ls, lease]);
    setShowForm(false); setEditing(null);
  };

  const del = (id) => { if (confirm("Delete this lease?")) setLeases(ls => ls.filter(l => l.id !== id)); };

  if (viewing) {
    const calc = calculateLease(viewing);
    return (
      <div>
        <button onClick={() => setViewing(null)} style={{ background: "none", border: "none", color: "#CC0000", cursor: "pointer", fontSize: 13, marginBottom: 20, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>← Back to Leases</button>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Georgia', serif", marginBottom: 4 }}>{viewing.name}</div>
        <div style={{ fontSize: 13, color: "#aaa", marginBottom: 24 }}>{viewing.type} · {viewing.status}</div>
        {calc ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
              <StatCard label="Right-of-Use Asset" value={fmt(calc.rightOfUseAsset)} accent />
              <StatCard label="Lease Liability" value={fmt(calc.liabilityOpening)} accent />
              <StatCard label="Total Interest" value={fmt(calc.totalInterest)} accent />
            </div>
            <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2, padding: "20px 24px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 3, height: 16, background: "#CC0000", display: "inline-block", borderRadius: 1 }}></span>
                Amortisation Schedule
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: "2px solid #f0f0f0", background: "#fafafa" }}>
                    {["Year", "Opening Balance", "Annual Payment", "Interest", "Repayment", "Closing Balance", "Depreciation", "ROU Carrying Value"].map(h =>
                      <th key={h} style={{ padding: "9px 12px", textAlign: "right", color: "#888", fontWeight: 700, fontSize: 11, letterSpacing: 0.8, whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {calc.schedule.map(r => (
                      <tr key={r.year} style={{ borderBottom: "1px solid #f7f7f7" }}>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#CC0000" }}>{r.period}</td>
                        {[r.openingBalance, r.annualPayment, r.interestCharge, r.repayment, r.closingBalance, r.depreciation, r.rouAssetCarrying].map((v, i) =>
                          <td key={i} style={{ padding: "9px 12px", textAlign: "right", color: "#444", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : <div style={{ color: "#aaa" }}>Unable to calculate — please check lease parameters.</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Georgia', serif" }}>Lease Register</div>
          <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>FRS 102 Section 20 compliant lease records</div>
        </div>
        {canEdit && !showForm && (
          <button onClick={() => { setShowForm(true); setEditing(null); }}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#CC0000", color: "#fff", border: "none", borderRadius: 2, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <Icon name="plus" size={16} /> Add Lease
          </button>
        )}
      </div>
      {(showForm || editing) && <div style={{ marginBottom: 24 }}><LeaseForm initial={editing} onSave={save} onCancel={() => { setShowForm(false); setEditing(null); }} /></div>}
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ borderBottom: "2px solid #f0f0f0", background: "#fafafa" }}>
            {["Lease Name", "Type", "Start Date", "Term", "Annual Payment", "Rate", "Status", "Actions"].map(h =>
              <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#888", fontWeight: 700, fontSize: 11, letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {leases.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#ccc" }}>No leases added yet.</td></tr>}
            {leases.map(l => (
              <tr key={l.id} style={{ borderBottom: "1px solid #f7f7f7" }}>
                <td style={{ padding: "11px 14px", fontWeight: 700, color: "#1a1a1a" }}>{l.name}</td>
                <td style={{ padding: "11px 14px", color: "#666" }}>{l.type}</td>
                <td style={{ padding: "11px 14px", color: "#666" }}>{l.commencementDate}</td>
                <td style={{ padding: "11px 14px", color: "#666" }}>{l.leaseTerm} yrs</td>
                <td style={{ padding: "11px 14px", color: "#444", fontVariantNumeric: "tabular-nums" }}>{fmt(l.annualPayment)}</td>
                <td style={{ padding: "11px 14px", color: "#444" }}>{fmtPct(l.interestRate)}</td>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{ background: l.status === "Active" ? "#fff0f0" : "#f5f5f5", color: l.status === "Active" ? "#CC0000" : "#888", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{l.status}</span>
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setViewing(l)} style={{ background: "none", border: "1.5px solid #e0e0e0", borderRadius: 2, padding: "5px 10px", cursor: "pointer", color: "#888" }} title="View"><Icon name="eye" size={14} /></button>
                    {canEdit && <>
                      <button onClick={() => { setEditing(l); setShowForm(false); }} style={{ background: "none", border: "1.5px solid #e0e0e0", borderRadius: 2, padding: "5px 10px", cursor: "pointer", color: "#888" }} title="Edit"><Icon name="calc" size={14} /></button>
                      <button onClick={() => del(l.id)} style={{ background: "none", border: "1.5px solid #ffcccc", borderRadius: 2, padding: "5px 10px", cursor: "pointer", color: "#CC0000" }} title="Delete"><Icon name="trash" size={14} /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalculatorPage() {
  const [form, setForm] = useState({ commencementDate: "", leaseTerm: "", annualPayment: "", interestRate: "", paymentFrequency: "Monthly", residualValue: "" });
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fieldStyle = { width: "100%", border: "1.5px solid #e0e0e0", borderRadius: 2, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#888", textTransform: "uppercase", marginBottom: 5 };

  const calc = () => {
    const r = calculateLease({ ...form, name: "Quick Calc", type: "Other", status: "Active" });
    setResult(r);
  };

  const exportCalc = () => {
    if (!result) return;
    exportToExcel(null, "FRS102_Lease_Calculation",
      ["Year", "Opening Balance (£)", "Annual Payment (£)", "Interest Charge (£)", "Repayment (£)", "Closing Balance (£)", "Depreciation (£)", "ROU Asset Carrying Value (£)"],
      result.schedule.map(r => [r.period, r.openingBalance, r.annualPayment, r.interestCharge, r.repayment, r.closingBalance, r.depreciation, r.rouAssetCarrying])
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Georgia', serif" }}>Lease Calculator</div>
        <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>FRS 102 Section 20 — Right-of-Use Asset & Liability Calculator</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2, padding: "24px 28px", marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 18 }}>
          {[
            { label: "Commencement Date", key: "commencementDate", type: "date" },
            { label: "Lease Term (years)", key: "leaseTerm", type: "number" },
            { label: "Payment Frequency", key: "paymentFrequency", options: PAYMENT_FREQ },
          ].map(({ label, key, type, options }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              {options
                ? <select value={form[key]} onChange={e => set(key, e.target.value)} style={fieldStyle}>{options.map(o => <option key={o}>{o}</option>)}</select>
                : <input type={type || "text"} value={form[key]} onChange={e => set(key, e.target.value)} style={fieldStyle} />}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 20 }}>
          {[
            { label: "Annual Payment (£)", key: "annualPayment" },
            { label: "Incremental Borrowing Rate (%)", key: "interestRate" },
            { label: "Residual Value (£)", key: "residualValue" },
          ].map(({ label, key }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input type="number" value={form[key]} onChange={e => set(key, e.target.value)} style={fieldStyle} min="0" />
            </div>
          ))}
        </div>
        <div style={{ background: "#fff8f8", border: "1px solid #ffe0e0", borderRadius: 2, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#888", lineHeight: 1.6 }}>
          <strong style={{ color: "#CC0000" }}>FRS 102 Note:</strong> The incremental borrowing rate is used to discount future lease payments to present value. Under FRS 102 Section 20, lessees must recognise right-of-use assets and lease liabilities for all leases (subject to exemptions for short-term and low-value assets).
        </div>
        <button onClick={calc} style={{ background: "#CC0000", color: "#fff", border: "none", borderRadius: 2, padding: "11px 28px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Calculate
        </button>
      </div>
      {result && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
            <StatCard label="Right-of-Use Asset" value={fmt(result.rightOfUseAsset)} sub="Initial recognition" accent />
            <StatCard label="Lease Liability" value={fmt(result.liabilityOpening)} sub="Initial recognition" accent />
            <StatCard label="Total Finance Charge" value={fmt(result.totalInterest)} sub="Over lease term" accent />
          </div>
          <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 3, height: 16, background: "#CC0000", display: "inline-block", borderRadius: 1 }}></span>
                Amortisation Schedule
              </div>
              <button onClick={exportCalc} style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 2, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                <Icon name="download" size={14} /> Export to Excel
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#fafafa", borderBottom: "2px solid #f0f0f0" }}>
                  {["Year", "Opening Balance", "Annual Payment", "Interest", "Repayment", "Closing Balance", "Depreciation", "ROU Carrying Value"].map(h =>
                    <th key={h} style={{ padding: "9px 12px", textAlign: "right", color: "#888", fontWeight: 700, fontSize: 11, letterSpacing: 0.8 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {result.schedule.map(r => (
                    <tr key={r.year} style={{ borderBottom: "1px solid #f7f7f7" }}>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#CC0000" }}>{r.period}</td>
                      {[r.openingBalance, r.annualPayment, r.interestCharge, r.repayment, r.closingBalance, r.depreciation, r.rouAssetCarrying].map((v, i) =>
                        <td key={i} style={{ padding: "9px 12px", textAlign: "right", color: "#444", fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReportsPage({ leases }) {
  const [activeReport, setActiveReport] = useState("lease-register");

  const reports = [
    { id: "lease-register", label: "Lease Register" },
    { id: "liability-schedule", label: "Liability Schedule" },
    { id: "rou-schedule", label: "ROU Asset Schedule" },
    { id: "annual-charges", label: "Annual P&L Charges" },
    { id: "disclosure", label: "FRS 102 Disclosure Summary" },
  ];

  const exportLeaseRegister = () => {
    exportToExcel(null, "FRS102_Lease_Register",
      ["Lease Name", "Type", "Description", "Start Date", "Term (yrs)", "Annual Payment (£)", "Interest Rate (%)", "Payment Frequency", "Residual Value (£)", "ROU Asset (£)", "Lease Liability (£)", "Status"],
      leases.map(l => {
        const c = calculateLease(l);
        return [l.name, l.type, l.description || "", l.commencementDate, l.leaseTerm, parseFloat(l.annualPayment), parseFloat(l.interestRate), l.paymentFrequency, parseFloat(l.residualValue) || 0, c ? c.rightOfUseAsset : 0, c ? c.liabilityOpening : 0, l.status];
      })
    );
  };

  const exportLiabilitySchedule = () => {
    const rows = [];
    leases.forEach(l => {
      const c = calculateLease(l);
      if (c) c.schedule.forEach(s => rows.push([l.name, l.type, s.period, s.openingBalance, s.annualPayment, s.interestCharge, s.repayment, s.closingBalance]));
    });
    exportToExcel(null, "FRS102_Liability_Schedule",
      ["Lease Name", "Type", "Period", "Opening Balance (£)", "Annual Payment (£)", "Interest Charge (£)", "Capital Repayment (£)", "Closing Balance (£)"], rows);
  };

  const exportROUSchedule = () => {
    const rows = [];
    leases.forEach(l => {
      const c = calculateLease(l);
      if (c) c.schedule.forEach(s => rows.push([l.name, l.type, s.period, c.rightOfUseAsset, s.depreciation, s.rouAssetCarrying]));
    });
    exportToExcel(null, "FRS102_ROU_Asset_Schedule",
      ["Lease Name", "Type", "Period", "Cost (£)", "Depreciation Charge (£)", "Carrying Value (£)"], rows);
  };

  const exportAnnualCharges = () => {
    const rows = [];
    leases.forEach(l => {
      const c = calculateLease(l);
      if (c) c.schedule.forEach(s => rows.push([l.name, l.type, s.period, s.interestCharge, s.depreciation, s.totalExpense]));
    });
    exportToExcel(null, "FRS102_Annual_PL_Charges",
      ["Lease Name", "Type", "Period", "Finance Charge (£)", "Depreciation (£)", "Total P&L Charge (£)"], rows);
  };

  const exportDisclosure = () => {
    let totalLiab = 0, totalROU = 0, totalInterest = 0;
    const rows = [];
    leases.forEach(l => {
      const c = calculateLease(l);
      if (!c) return;
      const end = new Date(l.commencementDate);
      end.setFullYear(end.getFullYear() + parseInt(l.leaseTerm));
      totalLiab += c.liabilityOpening; totalROU += c.rightOfUseAsset; totalInterest += c.totalInterest;
      rows.push([l.name, l.type, l.commencementDate, end.toISOString().split("T")[0], l.leaseTerm, parseFloat(l.interestRate), c.rightOfUseAsset, c.liabilityOpening, c.totalInterest]);
    });
    rows.push(["TOTAL", "", "", "", "", "", totalROU, totalLiab, totalInterest]);
    exportToExcel(null, "FRS102_Disclosure_Summary",
      ["Lease Name", "Type", "Start Date", "End Date", "Term (yrs)", "Rate (%)", "ROU Asset (£)", "Lease Liability (£)", "Total Finance Charges (£)"], rows);
  };

  const exportFns = { "lease-register": exportLeaseRegister, "liability-schedule": exportLiabilitySchedule, "rou-schedule": exportROUSchedule, "annual-charges": exportAnnualCharges, "disclosure": exportDisclosure };

  const renderPreview = () => {
    if (leases.length === 0) return <div style={{ color: "#ccc", textAlign: "center", padding: 40 }}>No leases in the portfolio. Add leases first.</div>;

    if (activeReport === "lease-register") {
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#fafafa", borderBottom: "2px solid #f0f0f0" }}>
            {["Name", "Type", "Start", "Term", "Payment", "Rate", "ROU Asset", "Liability", "Status"].map(h =>
              <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: "#888", fontWeight: 700, fontSize: 11 }}>{h}</th>)}
          </tr></thead>
          <tbody>{leases.map(l => {
            const c = calculateLease(l);
            return <tr key={l.id} style={{ borderBottom: "1px solid #f7f7f7" }}>
              <td style={{ padding: "9px 12px", fontWeight: 700, color: "#1a1a1a" }}>{l.name}</td>
              <td style={{ padding: "9px 12px", color: "#666" }}>{l.type}</td>
              <td style={{ padding: "9px 12px", color: "#666" }}>{l.commencementDate}</td>
              <td style={{ padding: "9px 12px", color: "#666" }}>{l.leaseTerm}y</td>
              <td style={{ padding: "9px 12px", color: "#444", fontVariantNumeric: "tabular-nums" }}>{fmt(l.annualPayment)}</td>
              <td style={{ padding: "9px 12px", color: "#444" }}>{l.interestRate}%</td>
              <td style={{ padding: "9px 12px", color: "#CC0000", fontVariantNumeric: "tabular-nums" }}>{c ? fmt(c.rightOfUseAsset) : "—"}</td>
              <td style={{ padding: "9px 12px", fontVariantNumeric: "tabular-nums" }}>{c ? fmt(c.liabilityOpening) : "—"}</td>
              <td style={{ padding: "9px 12px" }}><span style={{ background: l.status === "Active" ? "#fff0f0" : "#f5f5f5", color: l.status === "Active" ? "#CC0000" : "#888", padding: "2px 8px", borderRadius: 20, fontSize: 11 }}>{l.status}</span></td>
            </tr>;
          })}</tbody>
        </table>
      );
    }

    if (activeReport === "annual-charges") {
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#fafafa", borderBottom: "2px solid #f0f0f0" }}>
            {["Lease", "Type", "Year", "Finance Charge", "Depreciation", "Total P&L"].map(h =>
              <th key={h} style={{ padding: "9px 12px", textAlign: "right", color: "#888", fontWeight: 700, fontSize: 11 }}>{h}</th>)}
          </tr></thead>
          <tbody>{leases.flatMap(l => {
            const c = calculateLease(l);
            if (!c) return [];
            return c.schedule.map(s => (
              <tr key={`${l.id}-${s.year}`} style={{ borderBottom: "1px solid #f7f7f7" }}>
                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{l.name}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "#666" }}>{l.type}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "#CC0000" }}>{s.period}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(s.interestCharge)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(s.depreciation)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(s.totalExpense)}</td>
              </tr>
            ));
          })}</tbody>
        </table>
      );
    }

    return <div style={{ color: "#aaa", textAlign: "center", padding: 40 }}>Click "Export to Excel" to generate this report.</div>;
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Georgia', serif" }}>Reports</div>
        <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>Export FRS 102 compliant lease reports to Excel</div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ width: 200, flexShrink: 0 }}>
          {reports.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              style={{ width: "100%", display: "block", textAlign: "left", padding: "10px 14px", background: activeReport === r.id ? "#fff0f0" : "none", border: "none", borderLeft: activeReport === r.id ? "3px solid #CC0000" : "3px solid transparent", color: activeReport === r.id ? "#CC0000" : "#666", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 2, fontWeight: activeReport === r.id ? 700 : 400, borderRadius: "0 2px 2px 0" }}>
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{reports.find(r => r.id === activeReport)?.label}</div>
              <button onClick={exportFns[activeReport]}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "#CC0000", color: "#fff", border: "none", borderRadius: 2, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Icon name="download" size={14} /> Export to Excel
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>{renderPreview()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersPage({ currentUser }) {
  const [users, setUsers] = useState(USERS);

  if (currentUser.role !== "Admin") return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <Icon name="lock" size={40} />
      <div style={{ color: "#aaa", marginTop: 16 }}>Access restricted to Administrators.</div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Georgia', serif" }}>User Management</div>
        <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>Manage system access and roles</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 2 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#fafafa", borderBottom: "2px solid #f0f0f0" }}>
            {["ID", "Name", "Username", "Role", "Access Level"].map(h =>
              <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#888", fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>{h}</th>)}
          </tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id} style={{ borderBottom: "1px solid #f7f7f7" }}>
              <td style={{ padding: "11px 16px", color: "#ccc" }}>{u.id}</td>
              <td style={{ padding: "11px 16px", fontWeight: 700, color: "#1a1a1a" }}>{u.name}</td>
              <td style={{ padding: "11px 16px", color: "#666" }}>{u.username}</td>
              <td style={{ padding: "11px 16px" }}>
                <span style={{ background: u.role === "Admin" ? "#fff0f0" : u.role === "Accountant" ? "#f0f4ff" : "#f5f5f5", color: u.role === "Admin" ? "#CC0000" : u.role === "Accountant" ? "#4466cc" : "#888", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{u.role}</span>
              </td>
              <td style={{ padding: "11px 16px", fontSize: 12, color: "#aaa" }}>
                {u.role === "Admin" ? "Full access — add, edit, delete, export" : u.role === "Accountant" ? "Add & edit leases, export reports" : "View only — no edit permissions"}
              </td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ padding: "12px 16px", background: "#fafafa", borderTop: "1px solid #f0f0f0", fontSize: 11, color: "#bbb" }}>
          Role definitions: Admin — full system access · Accountant — add/edit leases + reports · Viewer — read-only access
        </div>
      </div>
    </div>
  );
}

// ─── SAMPLE DATA ─────────────────────────────────────────────────────────────
const SAMPLE_LEASES = [
  { id: 1, name: "Head Office — 12 King St", type: "Property", description: "Main office lease", commencementDate: "2023-01-01", leaseTerm: "5", annualPayment: "48000", interestRate: "5.5", paymentFrequency: "Monthly", residualValue: "0", status: "Active" },
  { id: 2, name: "Company Car — Ford Transit", type: "Vehicle", description: "Delivery van", commencementDate: "2024-04-01", leaseTerm: "3", annualPayment: "9600", interestRate: "6.2", paymentFrequency: "Monthly", residualValue: "2000", status: "Active" },
  { id: 3, name: "Warehouse Unit B", type: "Property", description: "Storage facility", commencementDate: "2022-07-01", leaseTerm: "7", annualPayment: "30000", interestRate: "4.8", paymentFrequency: "Quarterly", residualValue: "0", status: "Active" },
];

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [active, setActive] = useState("dashboard");
  const [leases, setLeases] = useState(SAMPLE_LEASES);

  if (!user) return <LoginScreen onLogin={setUser} />;

  const pages = { dashboard: <Dashboard leases={leases} />, leases: <LeasesPage leases={leases} setLeases={setLeases} user={user} />, calculator: <CalculatorPage />, reports: <ReportsPage leases={leases} />, users: <UsersPage currentUser={user} /> };

  return (
    <div style={{ display: "flex", fontFamily: "'Georgia', serif", background: "#f7f7f7", minHeight: "100vh" }}>
      <Sidebar active={active} setActive={setActive} user={user} onLogout={() => setUser(null)} />
      <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
        {pages[active] || null}
      </main>
    </div>
  );
}
