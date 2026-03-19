from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func, Text
from app.db.database import Base

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default="active")  # active, completed, paused
    type = Column(String, default="shared")  # shared, private
    address = Column(String)
    hrsz = Column(String)
    total_area = Column(Float)
    floors = Column(String)
    budget = Column(Float, default=0)
    thumbnail_url = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
