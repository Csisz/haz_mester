from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func, Boolean
from typing import Optional
import os, uuid, aiofiles, base64, json, asyncio, anthropic
from app.db.database import get_db, Base
from app.models.user import User
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter()

# Document model inline
class ProjectDocument(Base):
    __tablename__ = "project_documents"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    mime_type = Column(String)
    file_size = Column(Integer)
    url = Column(String, nullable=False)
    category = Column(String, default="other")  # architectural, mechanical, structural, permit, other
    ai_summary = Column(Text, nullable=True)  # AI-extracted summary
    is_active = Column(Boolean, default=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())

ALLOWED_TYPES = {
    "image/jpeg": "image", "image/png": "image", "image/webp": "image",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "doc",
}

CATEGORY_LABELS = {
    "architectural": "Építészeti terv",
    "mechanical": "Gépészeti terv",
    "structural": "Statikai terv",
    "electrical": "Villamos terv",
    "permit": "Engedély / határozat",
    "modification": "Módosítás",
    "other": "Egyéb"
}

def get_ai_client():
    if not settings.ANTHROPIC_API_KEY:
        return None
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

async def extract_document_summary(file_path: str, mime_type: str, original_name: str) -> str:
    """Extract AI summary from document"""
    client = get_ai_client()
    if not client:
        return None
    try:
        with open(file_path, "rb") as f:
            data = base64.standard_b64encode(f.read()).decode("utf-8")

        prompt = f"""Ez egy építési projekthez feltöltött dokumentum: "{original_name}"

Elemezd a dokumentumot és adj egy rövid összefoglalót:
1. Mi ez a dokumentum? (típus, cél)
2. Milyen főbb információkat tartalmaz?
3. Milyen építési munkákra vonatkozik?
4. Van-e benne méret, szám, specifikáció amit érdemes kiemelni?

Max 300 szó, magyarul. Legyél konkrét és tömör."""

        if mime_type == "application/pdf":
            response = await asyncio.to_thread(client.messages.create,
                model="claude-sonnet-4-6",
                max_tokens=600,
                messages=[{"role": "user", "content": [
                    {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": data}},
                    {"type": "text", "text": prompt}
                ]}]
            )
        elif mime_type.startswith("image/"):
            response = await asyncio.to_thread(client.messages.create,
                model="claude-sonnet-4-6",
                max_tokens=600,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": data}},
                    {"type": "text", "text": prompt}
                ]}]
            )
        else:
            return "Dokumentum feltöltve (szöveges összefoglaló nem elérhető ehhez a formátumhoz)"

        return response.content[0].text
    except Exception as e:
        return f"Összefoglaló nem elérhető: {str(e)[:100]}"

@router.get("/project/{project_id}")
def list_documents(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id,
        ProjectDocument.is_active == True
    ).order_by(ProjectDocument.created_at.desc()).all()
    return [{
        "id": d.id, "name": d.name, "description": d.description,
        "original_filename": d.original_filename, "mime_type": d.mime_type,
        "file_size": d.file_size, "url": d.url, "category": d.category,
        "category_label": CATEGORY_LABELS.get(d.category, d.category),
        "ai_summary": d.ai_summary, "created_at": d.created_at,
    } for d in docs]

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    category: str = Form("other"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Nem támogatott: {file.content_type}. Fogadott: PDF, JPG, PNG, DOCX")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 50MB")

    ext = os.path.splitext(file.filename)[1]
    unique_name = f"doc_{uuid.uuid4()}{ext}"
    save_dir = os.path.join(settings.UPLOAD_DIR, "documents", str(project_id))
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, unique_name)

    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)

    url = f"/uploads/documents/{project_id}/{unique_name}"

    # Create DB record first
    doc = ProjectDocument(
        project_id=project_id, name=name, description=description,
        filename=unique_name, original_filename=file.filename,
        mime_type=file.content_type, file_size=len(content),
        url=url, category=category, uploaded_by=current_user.id
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Extract AI summary in background
    summary = await extract_document_summary(file_path, file.content_type, file.filename)
    if summary:
        doc.ai_summary = summary
        db.commit()

    return {
        "id": doc.id, "name": doc.name, "url": doc.url,
        "ai_summary": doc.ai_summary,
        "message": "Dokumentum feltöltve és elemezve"
    }

@router.delete("/{doc_id}")
def delete_document(doc_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(ProjectDocument).filter(ProjectDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Nem található")
    if doc.uploaded_by != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nincs jogosultság")
    doc.is_active = False
    db.commit()
    return {"message": "Törölve"}

@router.post("/ask/{project_id}")
async def ask_with_documents(
    project_id: int,
    request: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ask AI a question using project documents as context, with conversation history"""
    client = get_ai_client()
    if not client:
        raise HTTPException(status_code=503, detail="AI nem elérhető")

    question = request.get("question", "")
    history = request.get("history", [])  # [{role, content}, ...]
    if not question:
        raise HTTPException(status_code=400, detail="Kérdés szükséges")

    # Get all active documents with summaries
    docs = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id,
        ProjectDocument.is_active == True,
        ProjectDocument.ai_summary.isnot(None)
    ).all()

    doc_context = ""
    if docs:
        doc_context = "\n\nFELTÖLTÖTT DOKUMENTUMOK TARTALMA:\n"
        for d in docs:
            doc_context += f"\n--- {d.name} ({CATEGORY_LABELS.get(d.category, d.category)}) ---\n{d.ai_summary}\n"

    from app.api.routes.ai_analysis import PROJECT_CONTEXT
    system_prompt = f"""{PROJECT_CONTEXT}{doc_context}

Adj részletes, praktikus válaszokat a dokumentumokban lévő információk alapján. Hivatkozz a konkrét dokumentumokra ahol releváns. Emlékezz az előző üzenetekre és reflektálj rájuk."""

    # Build message history for multi-turn conversation
    messages = []
    for h in history[-10:]:  # last 10 exchanges to avoid token limit
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": question})

    response = await asyncio.to_thread(client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=system_prompt,
        messages=messages
    )
    return {"answer": response.content[0].text}
