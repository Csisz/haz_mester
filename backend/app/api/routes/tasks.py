from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from app.db.database import get_db
from app.models.task import Task
from app.models.other import Comment, Attachment
from app.models.user import User
from app.models.project_member import ProjectMember
from app.core.security import get_current_user
import json

router = APIRouter()

class CreateTaskRequest(BaseModel):
    project_id: int
    title: str
    description: Optional[str] = None
    status: str = "pending"
    priority: str = "medium"
    category: Optional[str] = None
    unit: Optional[str] = None
    estimated_cost: Optional[float] = 0
    due_date: Optional[date] = None
    assigned_to: Optional[int] = None

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    due_date: Optional[date] = None
    assigned_to: Optional[int] = None

def user_can_access_project(project_id: int, user: User, db: Session):
    if user.role == "admin":
        return True
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id, ProjectMember.user_id == user.id
    ).first()
    return member is not None

def format_task(task: Task, db: Session):
    assigned_user = None
    if task.assigned_to:
        u = db.query(User).filter(User.id == task.assigned_to).first()
        if u:
            assigned_user = {"id": u.id, "username": u.username, "full_name": u.full_name}
    
    creator = None
    if task.created_by:
        u = db.query(User).filter(User.id == task.created_by).first()
        if u:
            creator = {"id": u.id, "username": u.username, "full_name": u.full_name}
    
    comment_count = db.query(Comment).filter(Comment.task_id == task.id).count()
    attachment_count = db.query(Attachment).filter(Attachment.task_id == task.id).count()
    
    ai_suggestions = None
    if task.ai_suggestions:
        try:
            ai_suggestions = json.loads(task.ai_suggestions)
        except:
            ai_suggestions = task.ai_suggestions
    
    return {
        "id": task.id,
        "project_id": task.project_id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "category": task.category,
        "unit": task.unit,
        "estimated_cost": task.estimated_cost,
        "actual_cost": task.actual_cost,
        "due_date": task.due_date,
        "completed_at": task.completed_at,
        "assigned_to": assigned_user,
        "created_by": creator,
        "ai_suggestions": ai_suggestions,
        "comment_count": comment_count,
        "attachment_count": attachment_count,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }

@router.get("/project/{project_id}")
def list_tasks(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user_can_access_project(project_id, current_user, db):
        raise HTTPException(status_code=403, detail="Nincs hozzáférés")
    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.created_at.desc()).all()
    return [format_task(t, db) for t in tasks]

@router.get("/{task_id}")
def get_task(task_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Feladat nem található")
    if not user_can_access_project(task.project_id, current_user, db):
        raise HTTPException(status_code=403, detail="Nincs hozzáférés")
    
    # Get attachments
    attachments = db.query(Attachment).filter(Attachment.task_id == task_id).all()
    attachment_list = [{"id": a.id, "filename": a.original_filename, "file_type": a.file_type,
                        "url": a.url, "created_at": a.created_at, "ai_analysis": a.ai_analysis} for a in attachments]
    
    # Get comments with user info
    comments_raw = db.query(Comment, User).join(User, Comment.user_id == User.id).filter(
        Comment.task_id == task_id
    ).order_by(Comment.created_at.asc()).all()
    comments = [{"id": c.id, "content": c.content, "created_at": c.created_at,
                 "user": {"id": u.id, "username": u.username, "full_name": u.full_name, "avatar_url": u.avatar_url}}
                for c, u in comments_raw]
    
    result = format_task(task, db)
    result["attachments"] = attachment_list
    result["comments"] = comments
    return result

@router.post("")
def create_task(request: CreateTaskRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user_can_access_project(request.project_id, current_user, db):
        raise HTTPException(status_code=403, detail="Nincs hozzáférés")
    task = Task(
        project_id=request.project_id, title=request.title, description=request.description,
        status=request.status, priority=request.priority, category=request.category,
        unit=request.unit, estimated_cost=request.estimated_cost, due_date=request.due_date,
        assigned_to=request.assigned_to, created_by=current_user.id
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return format_task(task, db)

@router.put("/{task_id}")
def update_task(task_id: int, request: UpdateTaskRequest, 
                current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Feladat nem található")
    if not user_can_access_project(task.project_id, current_user, db):
        raise HTTPException(status_code=403, detail="Nincs hozzáférés")
    
    for field, value in request.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    
    if request.status == "completed":
        from datetime import datetime
        task.completed_at = datetime.utcnow()
    
    db.commit()
    return format_task(task, db)

@router.delete("/{task_id}")
def delete_task(task_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Feladat nem található")
    if current_user.role != "admin" and task.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Nincs jogosultság")
    db.delete(task)
    db.commit()
    return {"message": "Feladat törölve"}
