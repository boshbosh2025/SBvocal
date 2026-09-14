from datetime import datetime

from pydantic import BaseModel


class MailOut(BaseModel):
    id: int
    sender: str
    recipient: str
    subject: str
    body: str
    sent_at: datetime | None = None
    starred: bool = False
    read: bool = False
    trash: bool = False
    attachments: str = ""

    class Config:
        from_attributes = True
