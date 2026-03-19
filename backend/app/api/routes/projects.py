from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.task import Task
from app.models.other import FinanceEntry
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

class CreateProjectRequest(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "shared"
    address: Optional[str] = None
    budget: Optional[float] = 0

class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None

def user_can_access(project_id: int, user: User, db: Session):
    if user.role == "admin":
        return True
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id
    ).first()
    return member is not None

@router.get("")
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        projects = db.query(Project).all()
    else:
        member_project_ids = db.query(ProjectMember.project_id).filter(
            ProjectMember.user_id == current_user.id
        ).all()
        project_ids = [m[0] for m in member_project_ids]
        projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    
    result = []
    for p in projects:
        tasks = db.query(Task).filter(Task.project_id == p.id).all()
        total_estimated = sum(t.estimated_cost or 0 for t in tasks)
        total_actual = sum(t.actual_cost or 0 for t in tasks)
        completed = sum(1 for t in tasks if t.status == "completed")
        members = db.query(ProjectMember).filter(ProjectMember.project_id == p.id).count()
        result.append({
            "id": p.id, "name": p.name, "description": p.description,
            "status": p.status, "type": p.type, "address": p.address,
            "hrsz": p.hrsz, "total_area": p.total_area, "floors": p.floors,
            "budget": p.budget, "thumbnail_url": p.thumbnail_url,
            "created_at": p.created_at,
            "stats": {
                "total_tasks": len(tasks),
                "completed_tasks": completed,
                "estimated_cost": total_estimated,
                "actual_cost": total_actual,
                "member_count": members,
            }
        })
    return result

@router.get("/{project_id}")
def get_project(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user_can_access(project_id, current_user, db):
        raise HTTPException(status_code=403, detail="Nincs hozzáférés")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")
    
    members_raw = db.query(ProjectMember, User).join(User, ProjectMember.user_id == User.id).filter(
        ProjectMember.project_id == project_id
    ).all()
    members = [{"id": u.id, "username": u.username, "full_name": u.full_name, 
                "can_edit": m.can_edit, "avatar_url": u.avatar_url} for m, u in members_raw]
    
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    
    return {
        "id": project.id, "name": project.name, "description": project.description,
        "status": project.status, "type": project.type, "address": project.address,
        "hrsz": project.hrsz, "total_area": project.total_area, "floors": project.floors,
        "budget": project.budget, "created_at": project.created_at,
        "members": members,
        "stats": {
            "total_tasks": len(tasks),
            "completed_tasks": sum(1 for t in tasks if t.status == "completed"),
            "in_progress": sum(1 for t in tasks if t.status == "in_progress"),
            "pending": sum(1 for t in tasks if t.status == "pending"),
            "critical": sum(1 for t in tasks if t.priority == "critical"),
            "estimated_cost": sum(t.estimated_cost or 0 for t in tasks),
            "actual_cost": sum(t.actual_cost or 0 for t in tasks),
        }
    }

@router.post("")
def create_project(request: CreateProjectRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = Project(
        name=request.name, description=request.description,
        type=request.type, address=request.address, budget=request.budget,
        created_by=current_user.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    member = ProjectMember(project_id=project.id, user_id=current_user.id, can_edit=True)
    db.add(member)
    db.commit()
    return {"id": project.id, "message": "Projekt létrehozva"}

@router.put("/{project_id}")
def update_project(project_id: int, request: UpdateProjectRequest, 
                   current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user_can_access(project_id, current_user, db):
        raise HTTPException(status_code=403, detail="Nincs hozzáférés")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")
    if request.name: project.name = request.name
    if request.description: project.description = request.description
    if request.status: project.status = request.status
    if request.budget is not None: project.budget = request.budget
    db.commit()
    return {"message": "Projekt frissítve"}

@router.post("/{project_id}/members/{user_id}")
def add_member(project_id: int, user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin jogosultság szükséges")
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Felhasználó már tagja a projektnek")
    member = ProjectMember(project_id=project_id, user_id=user_id, can_edit=True)
    db.add(member)
    db.commit()
    return {"message": "Tag hozzáadva"}
