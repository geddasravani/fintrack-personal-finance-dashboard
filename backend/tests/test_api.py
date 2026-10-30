import os
import tempfile
from datetime import date

import pytest
from fastapi.testclient import TestClient

# Use an isolated database for tests — must be set before importing the app.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"

from app.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(scope="module")
def headers():
    r = client.post(
        "/api/auth/register",
        json={"name": "Test User", "email": "test@example.com", "password": "secret123"},
    )
    assert r.status_code == 201
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def tx(**over):
    base = {"title": "Lunch", "amount": 100, "type": "expense", "category": "Food",
            "date": date.today().isoformat()}
    base.update(over)
    return base


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_duplicate_register_rejected(headers):
    r = client.post("/api/auth/register",
                    json={"name": "X", "email": "TEST@example.com", "password": "secret123"})
    assert r.status_code == 409


def test_login_and_me(headers):
    r = client.post("/api/auth/login", json={"email": "test@example.com", "password": "secret123"})
    assert r.status_code == 200
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert me.json()["email"] == "test@example.com"


def test_bad_login():
    r = client.post("/api/auth/login", json={"email": "test@example.com", "password": "wrong-pass"})
    assert r.status_code == 401


def test_requires_auth():
    assert client.get("/api/transactions").status_code == 401
    assert client.get("/api/analytics/summary").status_code == 401


def test_validation(headers):
    assert client.post("/api/transactions", json=tx(amount=-5), headers=headers).status_code == 422
    assert client.post("/api/transactions", json=tx(type="loan"), headers=headers).status_code == 422


def test_crud_flow(headers):
    created = client.post("/api/transactions", json=tx(title="Pizza", amount=250), headers=headers)
    assert created.status_code == 201
    tx_id = created.json()["id"]

    updated = client.put(f"/api/transactions/{tx_id}", json=tx(title="Pizza night", amount=300), headers=headers)
    assert updated.json()["amount"] == 300

    listing = client.get("/api/transactions", params={"search": "pizza"}, headers=headers).json()
    assert listing["total"] == 1 and listing["items"][0]["title"] == "Pizza night"

    assert client.delete(f"/api/transactions/{tx_id}", headers=headers).status_code == 204
    assert client.delete(f"/api/transactions/{tx_id}", headers=headers).status_code == 404


def test_analytics_numbers(headers):
    client.post("/api/transactions", json=tx(title="Pay", amount=1000, type="income", category="Salary"), headers=headers)
    client.post("/api/transactions", json=tx(title="Rent", amount=400, category="Bills"), headers=headers)
    client.post("/api/transactions", json=tx(title="Snack", amount=100, category="Food"), headers=headers)

    s = client.get("/api/analytics/summary", headers=headers).json()
    assert s["total_income"] == 1000
    assert s["total_expense"] == 500
    assert s["balance"] == 500
    assert s["savings_rate"] == 50.0

    cats = client.get("/api/analytics/by-category", headers=headers).json()
    assert cats[0] == {"category": "Bills", "total": 400}

    monthly = client.get("/api/analytics/monthly", headers=headers).json()
    assert len(monthly) == 6
    assert monthly[-1]["income"] == 1000 and monthly[-1]["expense"] == 500


def test_users_are_isolated(headers):
    other = client.post("/api/auth/register",
                        json={"name": "Other", "email": "other@example.com", "password": "secret123"}).json()
    oh = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get("/api/transactions", headers=oh).json()["total"] == 0
    mine = client.get("/api/transactions", headers=headers).json()["items"][0]["id"]
    assert client.delete(f"/api/transactions/{mine}", headers=oh).status_code == 404


def test_csv_export(headers):
    r = client.get("/api/transactions/export", headers=headers)
    assert r.status_code == 200
    assert r.text.splitlines()[0] == "date,title,type,category,amount,note"
