import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login({ email: form.email, password: form.password });
      else await register(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand big"><span className="logo">₹</span> FinTrack</div>
        <p className="muted">Track income and spending. See where your money goes.</p>

        {mode === "register" && (
          <label>
            Name
            <input required value={form.name} onChange={set("name")} placeholder="Your name" />
          </label>
        )}
        <label>
          Email
          <input type="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" />
        </label>
        <label>
          Password
          <input type="password" required minLength={6} value={form.password} onChange={set("password")} placeholder="At least 6 characters" />
        </label>

        {error && <div className="error">{error}</div>}

        <button className="btn primary" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </button>

        <button
          type="button"
          className="link"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
