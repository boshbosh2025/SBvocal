from dotenv import load_dotenv
import os
import openai

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

from fastapi import FastAPI, Depends, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import logging, traceback

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "errors.log")
logging.basicConfig(
    level=logging.INFO,
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_FILE, encoding="utf-8")],
    format="%(asctime)s %(levelname)s %(message)s",
)

from backend.routers import auth, mail, ai_redaction
from backend.routers.auth import get_db, login as auth_login
from backend.routers.mail import send_mail as mail_send_mail, send_attachment_mail as mail_send_attachment_mail
from backend.schemas.user import UserLogin, Token
from backend.security import get_current_user

app = FastAPI()

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {str(exc)}"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth")
app.include_router(mail.router, prefix="/mail")
app.include_router(ai_redaction.router)

@app.post("/login", response_model=Token)
def login_alias(data: UserLogin, db: Session = Depends(get_db)):
    return auth_login(data, db)

@app.post("/send-mail")
async def send_mail_alias(
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(""),
    files: List[UploadFile] = File(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return await mail_send_mail(to, subject, body, files, current_user, db)

@app.post("/logout")
def logout_alias():
    return {"status": "success", "message": "Logged out successfully"}

@app.post("/send-attachment")
async def send_attachment_alias(
    files: List[UploadFile] = File(...),
    recipient: str = Form(...),
    subject: str = Form("Pièces jointes"),
    body: str = Form("Veuillez trouver les fichiers ci-joints."),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return await mail_send_attachment_mail(files, recipient, subject, body, current_user, db)

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API SBvocal 🚀"}
