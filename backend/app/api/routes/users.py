from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.models.user import User
from app.core.security import get_current_user, require_admin, get_password_hash
import secrets, string

router = APIRouter()

def generate_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

class CreateUserRequest(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    role: str = "standard"

class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("")
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_active == True).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name, 
             "email": u.email, "role": u.role, "avatar_url": u.avatar_url} for u in users]

@router.post("")
def create_user(request: CreateUserRequest, admin = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == request.username).first():
        raise HTTPException(status_code=400, detail="Felhasználónév már foglalt")
    pwd = generate_password()
    user = User(
        username=request.username,
        full_name=request.full_name,
        email=request.email,
        role=request.role,
        hashed_password=get_password_hash(pwd),
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "full_name": user.full_name, 
            "generated_password": pwd, "message": "Felhasználó létrehozva"}

@router.put("/{user_id}")
def update_user(user_id: int, request: UpdateUserRequest, admin = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Felhasználó nem található")
    if request.full_name: user.full_name = request.full_name
    if request.email: user.email = request.email
    if request.role: user.role = request.role
    if request.is_active is not None: user.is_active = request.is_active
    db.commit()
    return {"message": "Felhasználó frissítve"}

@router.post("/{user_id}/reset-password")
def reset_password(user_id: int, admin = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Felhasználó nem található")
    pwd = generate_password()
    user.hashed_password = get_password_hash(pwd)
    user.must_change_password = True
    db.commit()
    return {"generated_password": pwd, "message": "Jelszó visszaállítva"}
