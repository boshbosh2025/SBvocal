import os
import openai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from spellchecker import SpellChecker

router = APIRouter()
spell = SpellChecker(language="fr")

class AiRedactionRequest(BaseModel):
    text: str

class AiRedactionResponse(BaseModel):
    correctedText: str
    fallback: str = ""

@router.post("/api/ai-redaction", response_model=AiRedactionResponse)
async def ai_redaction(req: AiRedactionRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": req.text}],
        )
        corrected = response.choices[0].message.content.strip()
        return AiRedactionResponse(correctedText=corrected)
    except Exception:
        words = req.text.split()
        corrected_words = [spell.correction(word) or word for word in words]
        corrected = " ".join(corrected_words)
        return AiRedactionResponse(correctedText=corrected, fallback="SpellChecker utilisé")
