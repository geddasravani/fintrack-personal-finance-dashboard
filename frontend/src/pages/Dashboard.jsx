import { useCallback, useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api.js";
import { CATEGORY_COLORS, monthLabel, money } from "../utils.js";

function StatCard({ label, value, tone }) {
  return (
    <div className="card stat">
      <div className="muted small">{label}</div>
      <div className={`stat-value ${tone || ""}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, c, m] = await Promise.all([api.summary(), api.byCategory(), api.monthly(6)]);
      setSummary(s);
      setCategories(c);
      setMonthly(m.map((p) => ({ ...p, label: monthLabel(p.month) })));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const seed = async () => {
    setSeeding(true);
    try { await api.seedDemo(); await load(); } finally { setSeeding(false); }
  };

  if (error) return <div className="error">{error}</div>;
  if (!summary) return <div className="muted">Loading dashboard…</div>;

  if (summary.transaction_count === 0) {
    return (
      <div className="card empty">
        <h2>Welcome to FinTrack</h2>
        <p className="muted">You have no transactions yet. Add your first one, or load sample data to explore.</p>
        <div className="row center-row">
          <button className="btn primary" onClick={seed} disabled={seeding}>
            {seeding ? "Loading…" : "Load sample data"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1>Dashboard</h1>
      <div className="grid4">
        <StatCard label="Balance" value={money(summary.balance)} tone={summary.balance >= 0 ? "pos" : "neg"} />
        <StatCard label="Total income" value={money(summary.total_income)} tone="pos" />
        <StatCard label="Total expenses" value={money(summary.total_expense)} tone="neg" />
        <StatCard label="Savings rate" value={`${summary.savings_rate}%`} />
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Income vs expenses (6 months)</h3>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3350" />
                <XAxis dataKey="label" stroke="#8b95b5" />
                <YAxis stroke="#8b95b5" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => money(v)} contentStyle={{ background: "#141a2e", border: "1px solid #2a3350" }} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#fb7185" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Spending by category</h3>
          <div className="chart">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={categories} dataKey="total" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {categories.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => money(v)} contentStyle={{ background: "#141a2e", border: "1px solid #2a3350" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
