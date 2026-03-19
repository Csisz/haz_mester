from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import os, uuid, aiofiles
from app.db.database import get_db
from app.models.other import Attachment
from app.models.task import Task
from app.models.user import User
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg": "image", "image/png": "image", "image/gif": "image", "image/webp": "image",
    "application/pdf": "document", "application/msword": "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.ms-excel": "document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    task_id: Optional[int] = Form(None),
    project_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Nem támogatott fájltípus: {file.content_type}")
    
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="Fájl mérete meghaladja az 50MB limitet")
    
    file_ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4()}{file_ext}"
    
    save_dir = os.path.join(settings.UPLOAD_DIR, str(current_user.id))
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, unique_name)
    
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    url = f"/uploads/{current_user.id}/{unique_name}"
    file_type = ALLOWED_TYPES[file.content_type]
    
    attachment = Attachment(
        task_id=task_id, project_id=project_id, user_id=current_user.id,
        filename=unique_name, original_filename=file.filename,
        file_type=file_type, mime_type=file.content_type,
        file_size=len(content), url=url
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    return {
        "id": attachment.id, "filename": attachment.original_filename,
        "file_type": attachment.file_type, "url": attachment.url,
        "file_size": attachment.file_size, "created_at": attachment.created_at
    }

@router.delete("/{attachment_id}")
def delete_attachment(attachment_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Fájl nem található")
    if attachment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nincs jogosultság")
    
    file_path = os.path.join(settings.UPLOAD_DIR, attachment.filename.lstrip("/uploads/"))
    full_path = os.path.join(settings.UPLOAD_DIR, attachment.url.replace("/uploads/", ""))
    if os.path.exists(full_path):
        os.remove(full_path)
    
    db.delete(attachment)
    db.commit()
    return {"message": "Fájl törölve"}
