const TOKEN_KEY = "fintrack_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = "GET", body, params, raw = false } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== "" && v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });

  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("fintrack:logout"));
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") detail = data.detail;
      else if (Array.isArray(data.detail)) detail = data.detail.map((d) => d.msg).join(", ");
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }
  if (raw) return res;
  return res.status === 204 ? null : res.json();
}

export const api = {
  register: (body) => request("/auth/register", { method: "POST", body }),
  login: (body) => request("/auth/login", { method: "POST", body }),
  me: () => request("/auth/me"),

  listTransactions: (params) => request("/transactions", { params }),
  categories: () => request("/transactions/categories"),
  createTransaction: (body) => request("/transactions", { method: "POST", body }),
  updateTransaction: (id, body) => request(`/transactions/${id}`, { method: "PUT", body }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),
  seedDemo: () => request("/transactions/seed-demo", { method: "POST" }),
  exportCsv: async (params) => {
    const res = await request("/transactions/export", { params, raw: true });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  },

  summary: () => request("/analytics/summary"),
  byCategory: () => request("/analytics/by-category"),
  monthly: (months = 6) => request("/analytics/monthly", { params: { months } }),
};
