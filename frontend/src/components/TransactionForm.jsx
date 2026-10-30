import { useEffect, useState } from "react";
import { today } from "../utils.js";

const SUGGESTED = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Salary", "Freelance"];
const empty = { title: "", amount: "", type: "expense", category: "Food", date: today(), note: "" };

export default function TransactionForm({ editing, onSave, onCancel }) {
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(editing ? { ...editing, note: editing.note || "" } : empty);
    setError("");
  }, [editing]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave({ ...form, amount: Number(form.amount), note: form.note || null });
      if (!editing) setForm(empty);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h3 className="span-all">{editing ? "Edit transaction" : "Add transaction"}</h3>
      <label>Title<input required value={form.title} onChange={set("title")} placeholder="e.g. Groceries" /></label>
      <label>Amount (₹)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={set("amount")} /></label>
      <label>Type
        <select value={form.type} onChange={set("type")}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>
      <label>Category
        <input required list="cats" value={form.category} onChange={set("category")} />
        <datalist id="cats">{SUGGESTED.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label>Date<input required type="date" value={form.date} onChange={set("date")} /></label>
      <label>Note<input value={form.note} onChange={set("note")} placeholder="Optional" /></label>
      {error && <div className="error span-all">{error}</div>}
      <div className="row span-all">
        <button className="btn primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add"}</button>
        {editing && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
