import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import anthropic, base64, os, json
from app.db.database import get_db
from app.models.other import FinanceEntry, Attachment
from app.models.user import User
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter()

def get_ai_client():
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI szolgáltatás nem konfigurálva")
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

@router.post("/scan")
async def scan_invoice(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    paid_by_user_id: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Scan an invoice image/PDF and extract financial data using AI"""
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 20MB")

    # Determine media type
    mime = file.content_type or "image/jpeg"
    if mime not in ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]:
        raise HTTPException(status_code=400, detail="Csak kép vagy PDF fogadható el")

    client = get_ai_client()

    # Get paid_by user info
    paid_by = db.query(User).filter(User.id == paid_by_user_id).first()
    if not paid_by:
        raise HTTPException(status_code=404, detail="Felhasználó nem található")

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
        response = await asyncio.to_thread(client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": image_data}},
                    {"type": "text", "text": prompt}
                ]
            }]
        )
    else:
        response = await asyncio.to_thread(client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": mime, "data": image_data}},
                    {"type": "text", "text": prompt}
                ]
            }]
        )

    text = response.content[0].text
    try:
        start = text.find('{')
        end = text.rfind('}') + 1
        extracted = json.loads(text[start:end])
    except:
        raise HTTPException(status_code=422, detail="Nem sikerült kiolvasni a számla adatait")

    # Save finance entry
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
        created_by=current_user.id
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    return {
        "success": True,
        "entry_id": entry.id,
        "extracted": extracted,
        "paid_by": {"id": paid_by.id, "full_name": paid_by.full_name},
        "message": f"Számla rögzítve: {extracted.get('amount', 0):,.0f} HUF — fizette: {paid_by.full_name}"
    }

@router.get("/summary/{project_id}")
def payment_summary(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get payment summary per person"""
    entries = db.query(FinanceEntry).filter(
        FinanceEntry.project_id == project_id,
        FinanceEntry.type == "expense"
    ).all()

    summary = {}
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

    return {
        "by_person": result,
        "total": total,
        "entry_count": len(entries)
    }
