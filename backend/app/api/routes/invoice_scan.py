import asyncio
import base64
import csv
import io
import json
import os
from datetime import datetime
from typing import List, Optional

import anthropic
import openpyxl
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db.database import get_db
from app.models.other import FinanceEntry, Attachment
from app.models.user import User

router = APIRouter()

VALID_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def get_ai_client():
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI szolgáltatás nem konfigurálva")
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# ── helpers ──────────────────────────────────────────────────────────────────

def _normalize(v) -> str:
    return (str(v) if v is not None else "").lower().strip()


def _names_overlap(a: str, b: str) -> bool:
    """True if either string contains the other (both non-empty)."""
    a, b = _normalize(a), _normalize(b)
    return bool(a and b and (a in b or b in a))


def _amounts_match(a, b) -> bool:
    a, b = float(a or 0), float(b or 0)
    if a <= 0 or b <= 0:
        return False
    return abs(a - b) / max(a, b) < 0.01   # within 1 %


def _dates_match(a, b) -> bool:
    a = (_normalize(a))[:10]
    b = (_normalize(b))[:10]
    return bool(a and b and a == b)


def _desc_overlap(a: str, b: str) -> bool:
    """True if descriptions share at least 2 meaningful words (len >= 4)."""
    words_a = {w for w in _normalize(a).split() if len(w) >= 4}
    words_b = {w for w in _normalize(b).split() if len(w) >= 4}
    return len(words_a & words_b) >= 2


def _find_duplicate(entry: dict, existing: list) -> Optional[FinanceEntry]:
    """
    Return the best-matching existing entry if at least 2 distinct fields agree.
    Fields checked: amount, date, payer (vendor/paid_by_name), description.
    Any two-field overlap triggers a duplicate warning.
    """
    e_amount = entry.get("amount")
    e_date   = (entry.get("date") or "")[:10]
    # payer: AI may put the name in vendor or description
    e_payer  = _normalize(entry.get("vendor") or "")
    e_desc   = _normalize(entry.get("description") or "")

    best: Optional[FinanceEntry] = None
    best_score = 0

    for db in existing:
        score = 0

        # 1. amount
        if _amounts_match(e_amount, db.amount):
            score += 1

        # 2. date
        if _dates_match(e_date, db.date):
            score += 1

        # 3. payer  (entry vendor vs db vendor OR db paid_by_name)
        db_payer_candidates = [
            _normalize(db.vendor or ""),
            _normalize(db.paid_by_name or ""),
        ]
        if e_payer and any(_names_overlap(e_payer, c) for c in db_payer_candidates if c):
            score += 1
        # also check if the entry description contains the db payer name
        elif e_desc and any(_names_overlap(e_desc, c) for c in db_payer_candidates if c):
            score += 1

        # 4. description
        if _desc_overlap(e_desc, db.description or ""):
            score += 1

        if score >= 2 and score > best_score:
            best_score = score
            best = db

    return best


def _parse_excel_to_text(content: bytes, filename: str) -> str:
    """Parse .xlsx or .csv into a tab-separated text table (max 300 rows)."""
    rows: list[list[str]] = []
    lower = filename.lower()

    if lower.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = [list(r) for r in reader]
    else:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        for row in ws.iter_rows(values_only=True):
            rows.append([str(c) if c is not None else "" for c in row])

    # Skip completely empty rows, cap at 300
    lines = []
    for row in rows[:300]:
        line = "\t".join(str(c) for c in row)
        if line.strip():
            lines.append(line)
    return "\n".join(lines)


def _entry_to_dict(e: FinanceEntry) -> dict:
    return {
        "id": e.id,
        "description": e.description,
        "vendor": e.vendor,
        "amount": e.amount,
        "date": str(e.date)[:10] if e.date else None,
        "invoice_number": e.invoice_number,
        "category": e.category,
    }


# ── scan image/pdf ────────────────────────────────────────────────────────────

@router.post("/scan")
async def scan_invoice(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    paid_by_user_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 20MB")

    mime = file.content_type or "image/jpeg"
    if mime not in VALID_IMAGE_TYPES and mime != "application/pdf":
        raise HTTPException(status_code=400, detail="Csak kép vagy PDF fogadható el")

    paid_by = db.query(User).filter(User.id == paid_by_user_id).first()
    if not paid_by:
        raise HTTPException(status_code=404, detail="Felhasználó nem található")

    client = get_ai_client()
    image_data = base64.standard_b64encode(content).decode("utf-8")

    prompt = """Elemezd ezt a számlát/bizonylatot és nyerd ki az adatokat.

Válaszolj CSAK JSON formátumban, semmi más szöveg:
{
  "vendor": "szállító/üzlet neve",
  "description": "rövid leírás miről szól a számla",
  "amount": 12345,
  "currency": "HUF",
  "date": "2024-01-15",
  "invoice_number": "számlaszám ha látható, egyébként null",
  "category": "material/labor/design/permit/other",
  "items": [
    {"name": "tétel neve", "quantity": 1, "unit_price": 1000, "total": 1000}
  ],
  "vat_amount": 0,
  "net_amount": 0,
  "confidence": "high/medium/low"
}

Fontos:
- amount: a BRUTTÓ végösszeg számként (nem string), forintban
- Ha nem HUF, váltsd át HUF-ba becsült árfolyamon
- category: material=anyag, labor=munkadíj, design=tervezés, permit=engedély, other=egyéb
- Ha nem látható valami, null legyen az értéke"""

    if mime == "application/pdf":
        response = await asyncio.to_thread(
            client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{"role": "user", "content": [
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": image_data}},
                {"type": "text", "text": prompt},
            ]}],
        )
    else:
        response = await asyncio.to_thread(
            client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": mime, "data": image_data}},
                {"type": "text", "text": prompt},
            ]}],
        )

    text = response.content[0].text
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        extracted = json.loads(text[start:end])
    except Exception:
        raise HTTPException(status_code=422, detail="Nem sikerült kiolvasni a számla adatait")

    entry = FinanceEntry(
        project_id=project_id,
        type="expense",
        category=extracted.get("category", "other"),
        description=f"{extracted.get('description', 'Számla')} — {extracted.get('vendor', '')}",
        amount=float(extracted.get("amount", 0)),
        currency=extracted.get("currency", "HUF"),
        invoice_number=extracted.get("invoice_number"),
        vendor=extracted.get("vendor"),
        paid_by=paid_by_user_id,
        paid_by_name=paid_by.full_name,
        created_by=current_user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "success": True,
        "entry_id": entry.id,
        "extracted": extracted,
        "paid_by": {"id": paid_by.id, "full_name": paid_by.full_name},
        "message": f"Számla rögzítve: {extracted.get('amount', 0):,.0f} HUF — fizette: {paid_by.full_name}",
    }


# ── analyze excel / csv ───────────────────────────────────────────────────────

@router.post("/analyze-excel")
async def analyze_excel(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    paid_by_user_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse an Excel/CSV file with AI and return extracted rows + duplicate flags."""
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 20MB")

    fname = file.filename or ""
    if not (fname.lower().endswith(".xlsx") or fname.lower().endswith(".csv")):
        raise HTTPException(status_code=400, detail="Csak .xlsx vagy .csv fájl fogadható el")

    paid_by = None
    if paid_by_user_id:
        paid_by = db.query(User).filter(User.id == paid_by_user_id).first()

    try:
        table_text = _parse_excel_to_text(content, fname)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Nem sikerült megnyitni a fájlt: {exc}")

    if not table_text.strip():
        raise HTTPException(status_code=422, detail="Az Excel fájl üres")

    client = get_ai_client()

    prompt = f"""Az alábbi táblázat pénzügyi tételeket tartalmaz. Elemezd az oszlopokat és minden adatsorhoz add meg a strukturált adatokat.

TÁBLÁZAT:
{table_text}

Azonosítsd az oszlopokat (leírás, összeg, dátum, szállító/partner, számlaszám, kategória stb.) és minden sorhoz add meg:
- description: tétel leírása (kötelező, ha üres marad hagyd ki a sort)
- amount: összeg számként HUF-ban (0 ha nem található)
- vendor: szállító/partner neve (null ha nincs)
- date: dátum "YYYY-MM-DD" formátumban (null ha nincs)
- invoice_number: számlaszám (null ha nincs)
- category: "material" / "labor" / "design" / "permit" / "other"
- type: "expense" / "income" / "estimate" (alapértelmezett: "expense")

Válaszolj CSAK JSON tömbben, semmi más szöveg:
[
  {{"description": "...", "amount": 12345, "vendor": "...", "date": "2024-01-15", "invoice_number": null, "category": "other", "type": "expense"}},
  ...
]

Fontos szabályok:
- Fejlécsort, üres sorokat és összesítő sorokat hagyd ki
- Ha egy sor nem tartalmaz érdemi pénzügyi adatot, hagyd ki
- Ha az összeg nem egyértelmű, 0 legyen
- Maximum 200 tételt adj vissza"""

    response = await asyncio.to_thread(
        client.messages.create,
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text
    try:
        start = text.find("[")
        end = text.rfind("]") + 1
        extracted_rows = json.loads(text[start:end])
    except Exception:
        raise HTTPException(status_code=422, detail="AI nem tudta feldolgozni a táblázatot")

    if not isinstance(extracted_rows, list):
        raise HTTPException(status_code=422, detail="Váratlan AI válasz formátum")

    # Duplicate detection against existing entries for this project
    existing = db.query(FinanceEntry).filter(FinanceEntry.project_id == project_id).all()

    result_rows = []
    for row in extracted_rows:
        if not row.get("description"):
            continue
        dup = _find_duplicate(row, existing)
        dup_dict = _entry_to_dict(dup) if dup else None
        result_rows.append({
            **row,
            "amount": float(row.get("amount") or 0),
            # duplicate rows get no default action → user MUST choose
            "action": None if dup_dict else "save",
            "duplicate": dup_dict,
        })

    return {
        "rows": result_rows,
        "paid_by": {"id": paid_by.id, "full_name": paid_by.full_name} if paid_by else None,
        "total_rows": len(result_rows),
        "duplicate_count": sum(1 for r in result_rows if r["duplicate"]),
    }


# ── save entries (bulk, with conflict resolution) ─────────────────────────────

class EntryToSave(BaseModel):
    action: str               # "save" | "skip" | "replace"
    duplicate_id: Optional[int] = None
    project_id: int
    type: str = "expense"
    category: str = "other"
    description: str
    amount: float
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    date: Optional[str] = None
    paid_by: Optional[int] = None
    paid_by_name: Optional[str] = None


class SaveEntriesRequest(BaseModel):
    entries: List[EntryToSave]


@router.post("/save-entries")
def save_entries(
    request: SaveEntriesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    saved = skipped = replaced = 0

    for item in request.entries:
        if item.action == "skip":
            skipped += 1
            continue

        entry_date = None
        if item.date:
            try:
                entry_date = datetime.strptime(item.date[:10], "%Y-%m-%d")
            except ValueError:
                pass

        if item.action == "replace" and item.duplicate_id:
            # Update the existing entry in-place
            existing = db.query(FinanceEntry).filter(FinanceEntry.id == item.duplicate_id).first()
            if existing:
                existing.description = item.description
                existing.amount = item.amount
                existing.vendor = item.vendor
                existing.invoice_number = item.invoice_number
                existing.category = item.category
                existing.type = item.type
                if entry_date:
                    existing.date = entry_date
                if item.paid_by:
                    existing.paid_by = item.paid_by
                    existing.paid_by_name = item.paid_by_name
                db.flush()
                replaced += 1
                continue

        # Default: save as new entry
        entry = FinanceEntry(
            project_id=item.project_id,
            type=item.type,
            category=item.category,
            description=item.description,
            amount=item.amount,
            invoice_number=item.invoice_number,
            vendor=item.vendor,
            paid_by=item.paid_by,
            paid_by_name=item.paid_by_name,
            date=entry_date or datetime.utcnow(),
            created_by=current_user.id,
        )
        db.add(entry)
        saved += 1

    db.commit()
    return {
        "saved": saved,
        "replaced": replaced,
        "skipped": skipped,
        "message": f"{saved + replaced} tétel mentve, {skipped} kihagyva",
    }


# ── payment summary ───────────────────────────────────────────────────────────

@router.get("/summary/{project_id}")
def payment_summary(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = db.query(FinanceEntry).filter(
        FinanceEntry.project_id == project_id,
        FinanceEntry.type == "expense",
    ).all()

    summary: dict = {}
    for e in entries:
        name = e.paid_by_name or "Ismeretlen"
        uid = e.paid_by or 0
        if uid not in summary:
            summary[uid] = {"user_id": uid, "name": name, "total": 0, "entries": []}
        summary[uid]["total"] += e.amount or 0
        summary[uid]["entries"].append({
            "id": e.id,
            "description": e.description,
            "amount": e.amount,
            "vendor": e.vendor,
            "date": e.date,
        })

    total = sum(v["total"] for v in summary.values())
    result = sorted(summary.values(), key=lambda x: x["total"], reverse=True)
    return {"by_person": result, "total": total, "entry_count": len(entries)}
