from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func

from backend.database import Base


class Mail(Base):
    __tablename__ = "mails"

    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String(255), nullable=False)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255))
    body = Column(Text(length=16777215))
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    starred = Column(Boolean, default=False)  # ✅ ajouté
    read = Column(Boolean, default=False)     # ✅ ajouté
    trash = Column(Boolean, default=False)    # ✅ ajouté
    attachments = Column(String(1000), default="")
