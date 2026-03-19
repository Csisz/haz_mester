from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.core.config import settings
from app.db.database import engine, Base
from app.db.init_db import init_db
from app.api.routes import auth, users, projects, tasks, comments, attachments, ai_analysis, finance

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - checkfirst=True means "skip if table already exists"
    Base.metadata.create_all(bind=engine, checkfirst=True)
    init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield
    # Shutdown

app = FastAPI(
    title="Építész - Construction Management",
    description="AI-assisted construction management for the Zugligeti út project",
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

# Static files for uploads
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# API routes
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(attachments.router, prefix="/api/attachments", tags=["attachments"])
app.include_router(ai_analysis.router, prefix="/api/ai", tags=["ai"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
