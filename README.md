# FinTrack — Personal Finance Dashboard

A full-stack web app to track income and expenses, visualize spending, and export data.
**React (Vite) + FastAPI (Python) + SQLite**, with JWT authentication and automated tests.

## Features

- Register / log in with JWT auth (PBKDF2-hashed passwords, per-user data isolation)
- Add, edit, delete transactions with server-side validation
- Search, filter by type/category, and paginate
- Dashboard: balance, income, expenses, savings rate
- Charts: income vs expenses (6 months) and spending by category
- Export filtered transactions to CSV
- One-click sample data to explore instantly
- 10 automated API tests (auth, CRUD, analytics accuracy, user isolation, CSV)

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 18, React Router, Recharts, Vite |
| Backend | Python, FastAPI, SQLAlchemy 2, Pydantic v2, PyJWT |
| Database | SQLite (swap via `DATABASE_URL`) |
| Testing | pytest, FastAPI TestClient |

## Run it locally

You need **Python 3.10+** and **Node.js 18+**. Open two terminals in VS Code.

### 1) Backend (terminal 1)

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API runs at http://127.0.0.1:8000 — interactive docs at http://127.0.0.1:8000/docs

### 2) Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, create an account, then click **Load sample data**.

### Run the tests

```bash
cd backend
pytest -q
```

## Project structure

```
fintrack/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, routers
│   │   ├── database.py      # SQLAlchemy engine/session
│   │   ├── models.py        # User, Transaction tables
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── security.py      # password hashing, JWT, auth dependency
│   │   └── routes/          # auth, transactions, analytics
│   └── tests/test_api.py
└── frontend/
    └── src/
        ├── api.js           # fetch wrapper (adds JWT, handles errors)
        ├── context/         # AuthContext (session state)
        ├── pages/           # Login, Dashboard, Transactions
        └── components/      # TransactionForm
```

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Get a JWT |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/transactions` | List (filters + paging) / create |
| PUT/DELETE | `/api/transactions/{id}` | Update / delete |
| GET | `/api/transactions/export` | CSV download |
| GET | `/api/analytics/summary` | Totals and savings rate |
| GET | `/api/analytics/by-category` | Expense totals per category |
| GET | `/api/analytics/monthly` | Income/expense per month |

## Design notes

- Every query is scoped by `user_id`, so users can never read or modify each other's data (covered by a test).
- Money amounts are validated as positive; type is restricted to `income` / `expense`.
- The Vite dev server proxies `/api` to the backend, so there are no CORS issues in development.
- Set `SECRET_KEY` and `DATABASE_URL` environment variables for production.

## Ideas to extend

Budgets with alerts, recurring transactions, Docker + CI, deploy (Render/Vercel), PostgreSQL.
