from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.models.other import Comment
from app.models.task import Task
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter()

class CreateCommentRequest(BaseModel):
    task_id: int
    content: str

@router.post("")
def create_comment(request: CreateCommentRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == request.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Feladat nem található")
    comment = Comment(task_id=request.task_id, user_id=current_user.id, content=request.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id, "content": comment.content, "created_at": comment.created_at,
        "user": {"id": current_user.id, "username": current_user.username, 
                 "full_name": current_user.full_name, "avatar_url": current_user.avatar_url}
    }

@router.delete("/{comment_id}")
def delete_comment(comment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Hozzászólás nem található")
    if comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nincs jogosultság")
    db.delete(comment)
    db.commit()
    return {"message": "Törölve"}
