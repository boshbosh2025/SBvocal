from fastapi import FastAPI

app = FastAPI(title="SpeedyBosh")

@app.get("/api/health")
def health():
    return {"status": "ok"}