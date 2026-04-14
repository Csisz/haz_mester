from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from sqlalchemy import inspect, text

from app.core.config import settings
from app.db.database import engine, Base
from app.db.init_db import init_db
from app.api.routes import auth, users, projects, tasks, comments, attachments, ai_analysis, finance, invoice_scan, documents

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create project_documents table if missing (defined in routes, not models)
    with engine.connect() as conn:
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS project_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name VARCHAR NOT NULL,
                description TEXT,
                filename VARCHAR NOT NULL,
                original_filename VARCHAR NOT NULL,
                mime_type VARCHAR,
                file_size INTEGER,
                url VARCHAR NOT NULL,
                category VARCHAR DEFAULT 'other',
                ai_summary TEXT,
                is_active BOOLEAN DEFAULT 1,
                uploaded_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        '''))
        conn.commit()
    inspector = inspect(engine)
    existing = inspector.get_table_names()
    if 'users' not in existing:
        Base.metadata.create_all(bind=engine)
    else:
        # Add new columns if they don't exist (migration)
        with engine.connect() as conn:
            cols = [c['name'] for c in inspector.get_columns('finance_entries')]
            if 'paid_by' not in cols:
                conn.execute(text("ALTER TABLE finance_entries ADD COLUMN paid_by INTEGER"))
                conn.execute(text("ALTER TABLE finance_entries ADD COLUMN paid_by_name VARCHAR"))
                conn.commit()
    init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield

app = FastAPI(
    title="Építész - Construction Management",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(attachments.router, prefix="/api/attachments", tags=["attachments"])
app.include_router(ai_analysis.router, prefix="/api/ai", tags=["ai"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
app.include_router(invoice_scan.router, prefix="/api/invoice", tags=["invoice"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
