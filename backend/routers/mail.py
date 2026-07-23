from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.security import get_current_user

router = APIRouter()

class MailPayload(BaseModel):
    destinataire: EmailStr
    objet: str
    corps: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/send")
def send_mail(payload: MailPayload, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    from backend.security import SMTP_EMAIL, SMTP_PASSWORD
    
    msg = MIMEMultipart()
    msg["From"] = SMTP_EMAIL
    msg["To"] = payload.destinataire
    msg["Subject"] = payload.objet
    msg.attach(MIMEText(payload.corps, "plain", "utf-8"))
    
    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, payload.destinataire, msg.as_string())
        return {"status": "sent", "message": "Email envoyé avec succès"}

    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=500, detail="Erreur Gmail: identifiants SMTP invalides. Vérifie ton adresse et ton mot de passe d'application.")
    except smtplib.SMTPException as e:
        raise HTTPException(status_code=500, detail=f"Erreur SMTP: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")
