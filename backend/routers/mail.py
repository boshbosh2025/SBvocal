from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import List
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from PyPDF2 import PdfReader, PdfWriter
import io

from backend.database import SessionLocal
from backend.models.mail import Mail
from backend.schemas.mail import MailOut
from backend.security import get_current_user
import os

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

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

@router.post("/upload")
async def upload_attachment(files: List[UploadFile] = File(...)):
    saved_files = []
    for file in files:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())
        saved_files.append(file.filename)
    return {"message": f"{len(saved_files)} fichier(s) reçu(s)", "files": saved_files}

@router.post("/send-multipart")
async def send_mail_multipart(
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(""),
    files: List[UploadFile] = File(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    saved_files = []
    if files:
        for file in files:
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as f:
                f.write(await file.read())
            saved_files.append(file.filename)

    try:
        from backend.security import SMTP_EMAIL, SMTP_PASSWORD
        from email.message import EmailMessage
        import mimetypes

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_EMAIL
        msg["To"] = to
        msg.set_content(body or "")

        if files:
            for file in files:
                file_data = await file.read()
                content_type, _ = mimetypes.guess_type(file.filename)
                if content_type is None or "/" not in content_type:
                    maintype, subtype = "application", "octet-stream"
                else:
                    maintype, subtype = content_type.split("/", 1)
                msg.add_attachment(file_data, maintype=maintype, subtype=subtype, filename=file.filename)

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(SMTP_EMAIL, SMTP_PASSWORD)
            smtp.send_message(msg)

        mail_record = Mail(
            sender=SMTP_EMAIL,
            recipient=to,
            subject=subject,
            body=body,
        )
        db.add(mail_record)
        db.commit()

        return {"message": f"Mail envoyé à {to} avec {len(saved_files)} fichier(s)", "body": body, "files": saved_files}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@router.post("/send")
async def send_mail(
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(""),
    files: List[UploadFile] = File(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import base64
    import re
    import traceback
    from email.message import EmailMessage
    import mimetypes
    from backend.security import SMTP_EMAIL, SMTP_PASSWORD, SMTP_SERVER, SMTP_PORT

    saved_files = []
    embedded_map = {}
    file_buffers = {}
    try:
        if files:
            for file in files:
                raw = await file.read()
                safe_name = re.sub(r'[\\/:*?"<>|]+', "_", os.path.basename(file.filename or "fichier")).strip()
                if not safe_name:
                    safe_name = "fichier"
                file_path = os.path.join(UPLOAD_DIR, safe_name)
                with open(file_path, "wb") as f:
                    f.write(raw)
                saved_files.append(safe_name)
                file_buffers[safe_name] = raw
                encoded = base64.b64encode(raw).decode("utf-8")
                embedded_map[safe_name] = (
                    f"<p><b>{safe_name}</b> (PDF intégré)</p>"
                    f"<embed src='data:application/pdf;base64,{encoded}' width='600' height='400' />"
                )

        def replace_marker(m):
            fname = m.group(1).strip()
            return embedded_map.get(fname, m.group(0))

        full_body = re.sub(r"\[PDF intégré: ([^\]]+)\]", replace_marker, body)
        for fname in saved_files:
            if f"[PDF intégré: {fname}]" not in body:
                full_body += "<br>" + embedded_map.get(fname, "")

        msg = EmailMessage()
        msg["Subject"] = subject or "(sans objet)"
        msg["From"] = SMTP_EMAIL
        msg["To"] = to
        msg.set_content(body or "")
        if embedded_map:
            msg.add_alternative(full_body, subtype="html")

        for fname, raw in file_buffers.items():
            content_type, _ = mimetypes.guess_type(fname)
            if content_type is None or "/" not in content_type:
                maintype, subtype = "application", "octet-stream"
            else:
                maintype, subtype = content_type.split("/", 1)
            msg.add_attachment(raw, maintype=maintype, subtype=subtype, filename=fname)

        from backend.models.user import User
        user = db.query(User).filter(User.id == current_user).first()
        sender_email = user.email if user else str(current_user)

        warnings = []
        smtp_sent = False
        try:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=60) as server:
                server.starttls()
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.send_message(msg)
            smtp_sent = True
        except smtplib.SMTPAuthenticationError:
            raise HTTPException(status_code=500, detail="Erreur Gmail: identifiants SMTP invalides. Vérifie SMTP_EMAIL et SMTP_PASSWORD.")
        except smtplib.SMTPRecipientsRefused as e:
            raise HTTPException(status_code=500, detail=f"Destinataire refusé: {str(e)}")
        except Exception as e:
            traceback.print_exc()
            warnings.append(f"Le mail a pu être envoyé malgré une erreur SMTP: {str(e)}")

        try:
            mail_record = Mail(
                sender=sender_email,
                recipient=to,
                subject=subject,
                body=full_body,
                attachments=", ".join(saved_files),
            )
            db.add(mail_record)
            db.commit()
            db.refresh(mail_record)
            mail_id = mail_record.id
        except Exception as e:
            db.rollback()
            traceback.print_exc()
            mail_id = None
            warnings.append(f"Le mail a été envoyé mais la sauvegarde en BDD a échoué: {str(e)}")

        return {
            "message": f"Mail envoyé à {to} avec {len(saved_files)} fichier(s)",
            "mail_id": mail_id,
            "files": saved_files,
            "body": full_body,
            "sent": smtp_sent,
            "warnings": warnings,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la préparation du mail: {str(e)}")

@router.get("/all", response_model=list[MailOut])
def get_all_mails(db: Session = Depends(get_db)):
    return db.query(Mail).filter(Mail.trash == False).order_by(Mail.sent_at.desc()).all()

@router.get("/starred", response_model=list[MailOut])
def get_starred_mails(db: Session = Depends(get_db)):
    return db.query(Mail).filter(Mail.starred == True, Mail.trash == False).order_by(Mail.sent_at.desc()).all()

@router.get("/trash", response_model=list[MailOut])
def get_trash_mails(db: Session = Depends(get_db)):
    return db.query(Mail).filter(Mail.trash == True).order_by(Mail.sent_at.desc()).all()

@router.delete("/{mail_id}")
def delete_mail(mail_id: int, db: Session = Depends(get_db)):
    mail = db.query(Mail).filter(Mail.id == mail_id).first()
    if not mail:
        raise HTTPException(status_code=404, detail="Mail not found")
    # Soft delete: move to trash instead of permanent deletion
    if mail.trash:
        # Already in trash: permanently delete
        db.delete(mail)
        db.commit()
        return {"status": "permanently deleted"}
    else:
        # Move to trash first
        mail.trash = True
        db.commit()
        return {"status": "moved to trash"}

@router.post("/{mail_id}/restore")
def restore_mail(mail_id: int, db: Session = Depends(get_db)):
    mail = db.query(Mail).filter(Mail.id == mail_id).first()
    if not mail:
        raise HTTPException(status_code=404, detail="Mail not found")
    mail.trash = False
    db.commit()
    return {"status": "restored from trash"}

@router.post("/{mail_id}/star")
def star_mail(mail_id: int, db: Session = Depends(get_db)):
    mail = db.query(Mail).filter(Mail.id == mail_id).first()
    if not mail:
        raise HTTPException(status_code=404, detail="Mail not found")
    mail.starred = not mail.starred
    db.commit()
    return {"status": "starred" if mail.starred else "unstarred"}

@router.post("/{mail_id}/read")
def mark_read(mail_id: int, db: Session = Depends(get_db)):
    mail = db.query(Mail).filter(Mail.id == mail_id).first()
    if not mail:
        raise HTTPException(status_code=404, detail="Mail not found")
    mail.read = True
    db.commit()
    return {"status": "marked as read"}

@router.post("/{mail_id}/unread")
def mark_unread(mail_id: int, db: Session = Depends(get_db)):
    mail = db.query(Mail).filter(Mail.id == mail_id).first()
    if not mail:
        raise HTTPException(status_code=404, detail="Mail not found")
    mail.read = False
    db.commit()
    return {"status": "marked as unread"}

@router.post("/pdf/select-pages")
async def select_pdf_pages(file: UploadFile = File(...)):
    reader = PdfReader(file.file)
    writer = PdfWriter()

    # Exemple : sélectionner les pages 1 et 3
    selected_pages = [0, 2]
    for page_num in selected_pages:
        writer.add_page(reader.pages[page_num])

    output = io.BytesIO()
    writer.write(output)
    output.seek(0)

    return {"selected_pages": [p + 1 for p in selected_pages]}

@router.post("/send-pdf")
@router.post("/mail/send-pdf")
async def send_pdf_mail(
    files: List[UploadFile] = File(...),
    recipient: str = Form(...),
    subject: str = Form("Documents PDF"),
    body: str = Form("Veuillez trouver les fichiers PDF ci-joints."),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        from backend.security import SMTP_EMAIL, SMTP_PASSWORD
        from email.message import EmailMessage
        
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_EMAIL
        msg["To"] = recipient
        msg.set_content(body)

        # Ajouter chaque PDF dans le même mail
        for file in files:
            pdf_data = await file.read()
            msg.add_attachment(pdf_data, maintype="application", subtype="pdf", filename=file.filename)

        # Envoyer un seul mail avec toutes les pièces jointes via SMTP_SSL
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(SMTP_EMAIL, SMTP_PASSWORD)
            smtp.send_message(msg)

        # Enregistrer en BDD
        mail_record = Mail(
            sender=SMTP_EMAIL,
            recipient=recipient,
            subject=subject,
            body=body,
        )
        db.add(mail_record)
        db.commit()

        return JSONResponse(content={"status": "sent", "filenames": [f.filename for f in files]})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@router.post("/send-attachment")
@router.post("/mail/send-attachment")
async def send_attachment_mail(
    files: List[UploadFile] = File(...),
    recipient: str = Form(...),
    subject: str = Form("Pièces jointes"),
    body: str = Form("Veuillez trouver les fichiers ci-joints."),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        from backend.security import SMTP_EMAIL, SMTP_PASSWORD
        from email.message import EmailMessage
        import mimetypes
        
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_EMAIL
        msg["To"] = recipient
        msg.set_content(body)

        for file in files:
            file_data = await file.read()
            content_type, _ = mimetypes.guess_type(file.filename)
            if content_type is None:
                content_type = "application/octet-stream"
            
            # Avoid split errors for content type
            if "/" in content_type:
                maintype, subtype = content_type.split("/", 1)
            else:
                maintype, subtype = "application", "octet-stream"
                
            msg.add_attachment(file_data, maintype=maintype, subtype=subtype, filename=file.filename)

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(SMTP_EMAIL, SMTP_PASSWORD)
            smtp.send_message(msg)

        mail_record = Mail(
            sender=SMTP_EMAIL,
            recipient=recipient,
            subject=subject,
            body=body,
        )
        db.add(mail_record)
        db.commit()

        return JSONResponse(content={"status": "sent", "filenames": [f.filename for f in files]})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

