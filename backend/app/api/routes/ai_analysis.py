from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import anthropic, base64, os, json, httpx, asyncio
from app.db.database import get_db
from app.models.task import Task
from app.models.other import Attachment
from app.models.project import Project
from app.models.user import User
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter()

PROJECT_CONTEXT = """
Te egy AI építési asszisztens vagy, aki a következő projektben segít:

PROJEKT: Kétlakásos ikerház felújítás és bővítés
CÍM: 1121 Budapest, Zugligeti út 44/A. (hrsz: 10761/60)
TERVEZŐ: Galambos Péter okl. építészmérnök (BÉK É 01-6171)
TERVEK DÁTUMA: 2023. május

ÉPÜLET ADATOK:
- 4 szintes: Pinceszint (57 m²) + Földszint (167 m²) + Emelet (161 m²) + Tetőtér (57 m²)
- Összesen: 442 m² bruttó szintterület, 860 m² telek
- 2 lakrész: 1. lakrész (Huszár Viktor és Csenge) + 2. lakrész (Ocskay László és Ágnes)

GÉPÉSZET: NGBS padlófűtés/hűtés rendszer, Pe-Xa csövek (Ø16x2,0), Tkf=38/30°C fűtés, 16/19°C hűtés
Fürdőszoba radiátorok: Vogel&Noot DELLA 1800×400 és 1800×600, elektromos fűtőpatronnal (Q=600W)
Osztó-gyűjtők: NGBS átfolyásmérővel

JELENLEGI STÁTUSZ:
- Esztrich beton: ELKÉSZÜLT
- Fűtés/hűtés panel szerelés: FOLYAMATBAN
- Ablakok: BEÉPÍTVE
- Ajtók: NEM BEÉPÍTVE
- Tetőterasz: LEBONTVA lemezszintig, vízszigetelés szükséges

AKTUÁLIS PROBLÉMA: Tetőterasz beázás mindkét egységet érinti, komplett vízszigetelési felújítás szükséges.

Mindig magyarul válaszolj, légy konkrét, és a valódi építési szakmában alkalmazott megoldásokat javasolj.
"""

def get_ai_client():
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI szolgáltatás nem konfigurálva")
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

class AnalyzeTaskRequest(BaseModel):
    task_id: int

class AnalyzeImageRequest(BaseModel):
    attachment_id: int
    question: Optional[str] = None

class AskAIRequest(BaseModel):
    question: str
    task_id: Optional[int] = None
    project_id: Optional[int] = None

class GenerateTasksRequest(BaseModel):
    project_id: int
    context: Optional[str] = None

@router.post("/analyze-task")
async def analyze_task(request: AnalyzeTaskRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == request.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Feladat nem található")
    
    client = get_ai_client()
    
    prompt = f"""{PROJECT_CONTEXT}

ELEMZENDŐ FELADAT:
Cím: {task.title}
Leírás: {task.description or 'Nincs leírás'}
Státusz: {task.status}
Prioritás: {task.priority}
Kategória: {task.category}
Becsült költség: {task.estimated_cost:,.0f} HUF

Kérem, elemezd ezt a feladatot és adj:
1. Lépésenkénti végrehajtási tervet (rétegrend, sorrend)
2. Szükséges anyagokat és mennyiségeket
3. Lehetséges kockázatokat és megoldásokat
4. Alternatív megközelítéseket (ha van)
5. Reális időbecslést
6. Közel 3 konkrét következő lépés javaslatot

Válaszolj JSON formátumban:
{{
  "summary": "rövid összefoglaló",
  "steps": ["1. lépés", "2. lépés", ...],
  "materials": [{{"name": "anyag", "quantity": "mennyiség", "unit": "egység"}}],
  "risks": [{{"risk": "kockázat", "mitigation": "megoldás"}}],
  "alternatives": ["alternatíva 1", ...],
  "time_estimate": "pl. 3-5 munkanap",
  "next_steps": ["azonnali következő lépés 1", "2", "3"],
  "cost_notes": "megjegyzések a költségbecsléshez"
}}"""
    
    response = await asyncio.to_thread(client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    text = response.content[0].text
    try:
        # Extract JSON from response
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            analysis = json.loads(text[start:end])
        else:
            analysis = {"summary": text, "steps": [], "materials": [], "risks": [], "next_steps": []}
    except:
        analysis = {"summary": text, "steps": [], "materials": [], "risks": [], "next_steps": []}
    
    # Save to task
    task.ai_suggestions = json.dumps(analysis, ensure_ascii=False)
    db.commit()
    
    return analysis

@router.post("/analyze-image")
async def analyze_image(request: AnalyzeImageRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    attachment = db.query(Attachment).filter(Attachment.id == request.attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Fájl nem található")
    if attachment.file_type != "image":
        raise HTTPException(status_code=400, detail="Csak képek elemezhetők")
    
    client = get_ai_client()
    
    # Load the image
    file_path = os.path.join(settings.UPLOAD_DIR, attachment.url.replace("/uploads/", ""))
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Fájl nem található a szerveren")
    
    with open(file_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")
    
    media_type = attachment.mime_type or "image/jpeg"
    
    question = request.question or "Elemezd ezt az építési fotót: mi látható, mi az aktuális állapot, és mik a következő javasolt lépések?"
    
    prompt = f"""{PROJECT_CONTEXT}

{question}

Válaszolj JSON formátumban:
{{
  "description": "mi látható a képen",
  "current_state": "az aktuális állapot értékelése",
  "issues_detected": ["azonosított probléma 1", ...],
  "recommendations": ["javaslat 1", "javaslat 2", ...],
  "next_steps": ["következő lépés 1", "2", "3"],
  "quality_assessment": "minőségi értékelés (ha releváns)",
  "urgency": "alacsony/közepes/magas/kritikus"
}}"""
    
    response = await asyncio.to_thread(client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_data}},
                {"type": "text", "text": prompt}
            ]
        }]
    )
    
    text = response.content[0].text
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        analysis = json.loads(text[start:end]) if start >= 0 else {"description": text}
    except:
        analysis = {"description": text}
    
    # Save analysis to attachment
    attachment.ai_analysis = json.dumps(analysis, ensure_ascii=False)
    db.commit()
    
    return analysis

@router.post("/ask")
async def ask_ai(request: AskAIRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    client = get_ai_client()
    
    context_addition = ""
    if request.task_id:
        task = db.query(Task).filter(Task.id == request.task_id).first()
        if task:
            context_addition = f"\nAKTUÁLIS FELADAT: {task.title}\n{task.description or ''}\n"
    
    # Load document summaries for context
    doc_context = ""
    if request.project_id:
        try:
            from app.api.routes.documents import ProjectDocument
            docs = db.query(ProjectDocument).filter(
                ProjectDocument.project_id == request.project_id,
                ProjectDocument.is_active == True,
                ProjectDocument.ai_summary.isnot(None)
            ).all()
            if docs:
                doc_context = "\n\nFELTÖLTÖTT DOKUMENTUMOK:\n"
                for d in docs:
                    doc_context += f"\n[{d.name}]: {d.ai_summary[:300]}\n"
        except:
            pass

    prompt = f"""{PROJECT_CONTEXT}{context_addition}{doc_context}

KÉRDÉS: {request.question}

Adj részletes, praktikus választ magyarul. Ha releváns dokumentum van a tudásbázisban, hivatkozz rá."""
    
    response = await asyncio.to_thread(client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return {"answer": response.content[0].text}

@router.post("/generate-tasks")
async def generate_tasks(request: GenerateTasksRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    client = get_ai_client()
    
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nem található")
    
    existing_tasks = db.query(Task).filter(Task.project_id == request.project_id).all()
    existing_titles = [t.title for t in existing_tasks]
    
    prompt = f"""{PROJECT_CONTEXT}

MEGLÉVŐ FELADATOK: {', '.join(existing_titles)}

{f'EXTRA KONTEXTUS: {request.context}' if request.context else ''}

Generálj 5-8 új, hiányzó feladatot a projekthez. Vedd figyelembe az aktuális állapotot és a terveket.
Csak olyan feladatokat javasolj, amik még nem szerepelnek a listában.

Válaszolj JSON formátumban:
{{
  "tasks": [
    {{
      "title": "feladat neve",
      "description": "részletes leírás",
      "priority": "low/medium/high/critical",
      "category": "waterproofing/hvac/carpentry/insulation/electrical/plumbing/finishing/other",
      "estimated_cost": 000000,
      "unit": "hatókör leírása"
    }}
  ]
}}"""
    
    response = await asyncio.to_thread(client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    text = response.content[0].text
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        result = json.loads(text[start:end])
        return result
    except:
        return {"tasks": [], "error": "Nem sikerült feladatokat generálni"}

@router.get("/suggestions/{project_id}")
async def get_project_suggestions(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get smart suggestions for the project based on current state"""
    client = get_ai_client()
    
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    task_summary = [{"title": t.title, "status": t.status, "priority": t.priority, "category": t.category} for t in tasks]
    
    completed = [t for t in tasks if t.status == "completed"]
    in_progress = [t for t in tasks if t.status == "in_progress"]
    pending = [t for t in tasks if t.status == "pending"]
    critical = [t for t in tasks if t.priority == "critical"]
    
    prompt = f"""{PROJECT_CONTEXT}

FELADATOK ÖSSZEFOGLALÓJA:
- Befejezett: {len(completed)}
- Folyamatban: {[t.title for t in in_progress]}
- Függőben: {[t.title for t in pending[:5]]}
- Kritikus prioritású: {[t.title for t in critical]}

Adj 3-5 konkrét, sürgős javaslatot a projekt előrehaladásához.
Válaszolj JSON formátumban:
{{
  "urgent_actions": ["azonnali teendő 1", "2", "3"],
  "warnings": ["figyelmeztetés 1", ...],
  "upcoming_dependencies": "mi függ mitől",
  "weekly_focus": "mire fókuszáljon a csapat ezen a héten"
}}"""
    
    response = await asyncio.to_thread(client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    text = response.content[0].text
    # Strip markdown code blocks if present
    text = text.replace('```json', '').replace('```', '').strip()
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            parsed = json.loads(text[start:end])
            # Ensure urgent_actions are plain strings, not objects
            actions = parsed.get("urgent_actions", [])
            parsed["urgent_actions"] = [
                a if isinstance(a, str) else str(a) for a in actions
            ]
            return parsed
    except Exception as e:
        pass
    # Fallback: extract numbered list from text as actions
    lines = [l.strip().lstrip('0123456789.-) ') for l in text.split('\n') if l.strip() and len(l.strip()) > 10]
    return {"urgent_actions": lines[:5], "warnings": [], "weekly_focus": ""}
