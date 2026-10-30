from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: EmailStr


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TransactionIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    amount: float = Field(gt=0)
    type: Literal["income", "expense"]
    category: str = Field(min_length=1, max_length=60)
    date: date
    note: str | None = Field(default=None, max_length=500)


class TransactionOut(TransactionIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int


class Summary(BaseModel):
    total_income: float
    total_expense: float
    balance: float
    savings_rate: float  # percent, 0 when there is no income
    transaction_count: int


class CategoryTotal(BaseModel):
    category: str
    total: float


class MonthlyPoint(BaseModel):
    month: str  # "YYYY-MM"
    income: float
    expense: float
