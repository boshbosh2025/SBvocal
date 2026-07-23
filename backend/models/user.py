from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)  # contient le HASH, jamais le mot de passe en clair
    created_at = Column(DateTime, default=datetime.utcnow)