from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Transaction, User
from ..schemas import CategoryTotal, MonthlyPoint, Summary
from ..security import get_current_user

router = APIRouter()


def _totals(db: Session, user: User) -> dict[str, float]:
    rows = db.execute(
        select(Transaction.type, func.coalesce(func.sum(Transaction.amount), 0.0))
        .where(Transaction.user_id == user.id)
        .group_by(Transaction.type)
    ).all()
    return {t: float(total) for t, total in rows}


@router.get("/summary", response_model=Summary)
def summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    totals = _totals(db, user)
    income = totals.get("income", 0.0)
    expense = totals.get("expense", 0.0)
    count = db.scalar(select(func.count()).where(Transaction.user_id == user.id)) or 0
    savings_rate = round((income - expense) / income * 100, 1) if income > 0 else 0.0
    return Summary(
        total_income=round(income, 2),
        total_expense=round(expense, 2),
        balance=round(income - expense, 2),
        savings_rate=savings_rate,
        transaction_count=count,
    )


@router.get("/by-category", response_model=list[CategoryTotal])
def by_category(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id, Transaction.type == "expense")
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    ).all()
    return [CategoryTotal(category=c, total=round(float(t), 2)) for c, t in rows]


def _month_keys(n: int) -> list[str]:
    today = date.today()
    year, month = today.year, today.month
    keys = []
    for _ in range(n):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(keys))


@router.get("/monthly", response_model=list[MonthlyPoint])
def monthly(
    months: int = Query(6, ge=1, le=24),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keys = _month_keys(months)
    first = date(int(keys[0][:4]), int(keys[0][5:]), 1)
    rows = db.execute(
        select(Transaction.date, Transaction.type, Transaction.amount).where(
            Transaction.user_id == user.id, Transaction.date >= first
        )
    ).all()
    buckets: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for d, t, amt in rows:
        buckets[d.strftime("%Y-%m")][t] += amt
    return [
        MonthlyPoint(month=k, income=round(buckets[k]["income"], 2), expense=round(buckets[k]["expense"], 2))
        for k in keys
    ]
