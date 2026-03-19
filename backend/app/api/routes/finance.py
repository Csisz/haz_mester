from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db.database import get_db
from app.models.other import FinanceEntry
from app.models.task import Task
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

class CreateFinanceEntryRequest(BaseModel):
    project_id: int
    task_id: Optional[int] = None
    type: str  # expense, income, estimate
    category: str  # material, labor, design, permit, other
    description: str
    amount: float
    currency: str = "HUF"
    invoice_number: Optional[str] = None
    vendor: Optional[str] = None
    date: Optional[datetime] = None

@router.get("/project/{project_id}")
def list_finance(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entries = db.query(FinanceEntry).filter(FinanceEntry.project_id == project_id).order_by(FinanceEntry.created_at.desc()).all()
    
    result = []
    for e in entries:
        creator = db.query(User).filter(User.id == e.created_by).first()
        task_title = None
        if e.task_id:
            task = db.query(Task).filter(Task.id == e.task_id).first()
            if task:
                task_title = task.title
        
        result.append({
            "id": e.id, "project_id": e.project_id, "task_id": e.task_id,
            "task_title": task_title, "type": e.type, "category": e.category,
            "description": e.description, "amount": e.amount, "currency": e.currency,
            "date": e.date, "invoice_number": e.invoice_number, "vendor": e.vendor,
            "created_by": {"id": creator.id, "full_name": creator.full_name} if creator else None,
            "created_at": e.created_at
        })
    return result

@router.get("/project/{project_id}/summary")
def finance_summary(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entries = db.query(FinanceEntry).filter(FinanceEntry.project_id == project_id).all()
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    
    total_expenses = sum(e.amount for e in entries if e.type == "expense")
    total_income = sum(e.amount for e in entries if e.type == "income")
    total_estimates = sum(t.estimated_cost or 0 for t in tasks)
    total_actual = sum(t.actual_cost or 0 for t in tasks)
    
    by_category = {}
    for e in entries:
        if e.type == "expense":
            by_category[e.category] = by_category.get(e.category, 0) + e.amount
    
    return {
        "total_expenses": total_expenses,
        "total_income": total_income,
        "total_estimated": total_estimates,
        "total_actual_task_costs": total_actual,
        "balance": total_income - total_expenses,
        "by_category": by_category,
        "entry_count": len(entries),
        "task_cost_completion": (total_actual / total_estimates * 100) if total_estimates > 0 else 0,
    }

@router.post("")
def create_entry(request: CreateFinanceEntryRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = FinanceEntry(
        project_id=request.project_id, task_id=request.task_id,
        type=request.type, category=request.category, description=request.description,
        amount=request.amount, currency=request.currency,
        invoice_number=request.invoice_number, vendor=request.vendor,
        date=request.date or datetime.utcnow(), created_by=current_user.id
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"id": entry.id, "message": "Bejegyzés létrehozva"}

@router.delete("/{entry_id}")
def delete_entry(entry_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = db.query(FinanceEntry).filter(FinanceEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Bejegyzés nem található")
    if entry.created_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nincs jogosultság")
    db.delete(entry)
    db.commit()
    return {"message": "Törölve"}
