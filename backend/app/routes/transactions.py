import csv
import io
import random
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, User
from ..schemas import TransactionIn, TransactionOut, TransactionPage
from ..security import get_current_user

router = APIRouter()


def _filtered(
    user: User,
    type: str | None,
    category: str | None,
    search: str | None,
    start: date | None,
    end: date | None,
):
    stmt = select(Transaction).where(Transaction.user_id == user.id)
    if type:
        stmt = stmt.where(Transaction.type == type)
    if category:
        stmt = stmt.where(Transaction.category == category)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Transaction.title.ilike(like), Transaction.note.ilike(like)))
    if start:
        stmt = stmt.where(Transaction.date >= start)
    if end:
        stmt = stmt.where(Transaction.date <= end)
    return stmt


@router.get("", response_model=TransactionPage)
def list_transactions(
    type: str | None = Query(None, pattern="^(income|expense)$"),
    category: str | None = None,
    search: str | None = None,
    start: date | None = None,
    end: date | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base = _filtered(user, type, category, search, start, end)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(
        base.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit).offset(offset)
    ).all()
    return TransactionPage(items=rows, total=total)


@router.get("/categories", response_model=list[str])
def list_categories(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Transaction.category).where(Transaction.user_id == user.id).distinct().order_by(Transaction.category)
    ).all()
    return list(rows)


@router.get("/export")
def export_csv(
    type: str | None = Query(None, pattern="^(income|expense)$"),
    category: str | None = None,
    search: str | None = None,
    start: date | None = None,
    end: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        _filtered(user, type, category, search, start, end).order_by(Transaction.date.desc())
    ).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "title", "type", "category", "amount", "note"])
    for t in rows:
        writer.writerow([t.date.isoformat(), t.title, t.type, t.category, f"{t.amount:.2f}", t.note or ""])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="transactions.csv"'},
    )


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    data: TransactionIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    tx = Transaction(user_id=user.id, **data.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def _get_owned(db: Session, user: User, tx_id: int) -> Transaction:
    tx = db.get(Transaction, tx_id)
    if tx is None or tx.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")
    return tx


@router.put("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: int,
    data: TransactionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tx = _get_owned(db, user, tx_id)
    for key, value in data.model_dump().items():
        setattr(tx, key, value)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    tx_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    tx = _get_owned(db, user, tx_id)
    db.delete(tx)
    db.commit()


@router.post("/seed-demo", status_code=status.HTTP_201_CREATED)
def seed_demo(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Insert ~6 months of realistic sample data so the dashboard looks alive."""
    rng = random.Random(42)
    today = date.today()
    expense_pool = {
        "Food": (150, 900, ["Groceries", "Restaurant", "Coffee", "Swiggy order"]),
        "Transport": (50, 600, ["Metro card", "Fuel", "Cab ride"]),
        "Shopping": (300, 3500, ["Clothes", "Electronics", "Online order"]),
        "Bills": (400, 2500, ["Electricity", "Internet", "Mobile recharge"]),
        "Entertainment": (200, 1200, ["Movie", "Streaming", "Concert"]),
        "Health": (200, 2000, ["Pharmacy", "Clinic visit"]),
    }
    created = 0
    for months_back in range(6):
        month_start = (today.replace(day=1) - timedelta(days=30 * months_back)).replace(day=1)
        db.add(Transaction(user_id=user.id, title="Monthly salary", amount=65000.0, type="income",
                           category="Salary", date=month_start + timedelta(days=1)))
        db.add(Transaction(user_id=user.id, title="Freelance project", amount=float(rng.randint(5, 15) * 1000),
                           type="income", category="Freelance", date=month_start + timedelta(days=14)))
        created += 2
        for _ in range(rng.randint(12, 18)):
            category, (lo, hi, titles) = rng.choice(list(expense_pool.items()))
            day = min(rng.randint(1, 28), (today - month_start).days if months_back == 0 else 28)
            db.add(Transaction(user_id=user.id, title=rng.choice(titles),
                               amount=float(rng.randint(lo, hi)), type="expense",
                               category=category, date=month_start + timedelta(days=max(day, 0))))
            created += 1
    db.commit()
    return {"created": created}
