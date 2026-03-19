from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, func
from app.db.database import Base

class ProjectMember(Base):
    __tablename__ = "project_members"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    can_edit = Column(Boolean, default=False)
    joined_at = Column(DateTime, server_default=func.now())
