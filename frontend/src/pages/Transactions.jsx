import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import TransactionForm from "../components/TransactionForm.jsx";
import { money } from "../utils.js";

const PAGE = 15;

export default function Transactions() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: "", type: "", category: "" });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [list, cats] = await Promise.all([
        api.listTransactions({ ...filters, limit: PAGE, offset: page * PAGE }),
        api.categories(),
      ]);
      setData(list);
      setCategories(cats);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [filters, page]);

  // Debounce so typing in search doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const setFilter = (k) => (e) => {
    setPage(0);
    setFilters({ ...filters, [k]: e.target.value });
  };

  const save = async (payload) => {
    if (editing) await api.updateTransaction(editing.id, payload);
    else await api.createTransaction(payload);
    setEditing(null);
    await load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this transaction?")) return;
    await api.deleteTransaction(id);
    await load();
  };

  const pages = Math.max(1, Math.ceil(data.total / PAGE));

  return (
    <div className="stack">
      <h1>Transactions</h1>
      <TransactionForm editing={editing} onSave={save} onCancel={() => setEditing(null)} />

      <div className="card">
        <div className="filters">
          <input placeholder="Search title or note…" value={filters.search} onChange={setFilter("search")} />
          <select value={filters.type} onChange={setFilter("type")}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select value={filters.category} onChange={setFilter("category")}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn ghost" onClick={() => api.exportCsv(filters)}>Export CSV</button>
        </div>

        {error && <div className="error">{error}</div>}

        <table>
          <thead>
            <tr><th>Date</th><th>Title</th><th>Category</th><th className="right">Amount</th><th /></tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.title}{t.note && <div className="muted small">{t.note}</div>}</td>
                <td><span className="pill">{t.category}</span></td>
                <td className={`right ${t.type === "income" ? "pos" : "neg"}`}>
                  {t.type === "income" ? "+" : "−"}{money(t.amount)}
                </td>
                <td className="right actions">
                  <button className="link" onClick={() => { setEditing(t); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                  <button className="link danger" onClick={() => remove(t.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr><td colSpan={5} className="muted center">No transactions found.</td></tr>
            )}
          </tbody>
        </table>

        <div className="pager">
          <button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {page + 1} of {pages} · {data.total} total</span>
          <button className="btn ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
