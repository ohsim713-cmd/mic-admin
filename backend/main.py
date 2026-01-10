from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from app.services import gemini_service

app = FastAPI(title="Chatre Post Generator API")

# フロントエンド（localhost:3000）からのアクセスを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    target: str
    atmosphere: str
    perks: List[str]

@app.get("/")
async def root():
    return {"message": "Chatre Post Generator API is running"}

@app.post("/api/generate")
async def generate_post(request: GenerateRequest):
    # Geminiを使って投稿文を生成
    generated_text = gemini_service.generate_chatre_post(
        target=request.target,
        atmosphere=request.atmosphere,
        perks=request.perks
    )
    
    if generated_text.startswith("Error:"):
         return {"status": "error", "message": generated_text}

    return {
        "status": "success",
        "generated_text": generated_text
    }
