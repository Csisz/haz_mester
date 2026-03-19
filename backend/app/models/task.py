from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func, Text, Date
from app.db.database import Base

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default="pending")  # pending, in_progress, review, completed, blocked
    priority = Column(String, default="medium")  # low, medium, high, critical
    category = Column(String)  # waterproofing, hvac, carpentry, insulation, electrical, plumbing, etc.
    unit = Column(String)  # description of scope
    estimated_cost = Column(Float, default=0)
    actual_cost = Column(Float, default=0)
    due_date = Column(Date, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    ai_suggestions = Column(Text, nullable=True)  # JSON string of AI suggestions
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
