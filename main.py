from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import SessionLocal, User, IncomeHistory, init_db
from engine import IDCS_Engine

app = FastAPI(title="Income Dip Compensation System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DB on startup
init_db()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class IncomeData(BaseModel):
    amount: float
    status: str
    category: str = "Revenue"

class UserRequest(BaseModel):
    name: str
    age: int
    employment_type: str

class EvaluationRequest(BaseModel):
    name: str
    age: int
    employment_type: str
    current_income: float
    income_history: list[IncomeData]
    premium: float = 0.0
    deferred_period: int = 30
    transaction_count: int = 15
    sector_dip: float = 0.0
    squad_no_claim_bonus: bool = False
    severe_weather_event: bool = False

class ChatRequest(BaseModel):
    system_prompt: str
    messages: list

engine = IDCS_Engine()

@app.get("/")
def read_root():
    return {"status": "online", "message": "Welcome to the IDCS API"}

@app.post("/user")
def get_or_create_user(req: UserRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.name == req.name).first()
    is_new = False
    
    if not user:
        user = User(
            name=req.name,
            age=req.age,
            employment_type=req.employment_type,
            src_tax_bracket="Bracket 3", 
            src_cap=50000.0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new = True

    incomes = db.query(IncomeHistory).filter(IncomeHistory.user_id == user.id).order_by(IncomeHistory.month_index).all()
    history = [{"amount": inc.income_amount, "status": inc.status, "month": inc.month_index} for inc in incomes]
    
    return {
        "user_id": user.id,
        "name": user.name,
        "history": history,
        "is_new": is_new
    }

@app.post("/evaluate")
def evaluate_claim(req: EvaluationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.name == req.name).first()
    
    # Auto-create user if not found
    if not user:
        user = User(
            name=req.name,
            age=req.age,
            employment_type=req.employment_type,
            src_tax_bracket="Bracket 3",
            src_cap=50000.0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # If new user and they provided history (from CSV), store it
        if req.income_history:
            for idx, inc in enumerate(req.income_history):
                db_inc = IncomeHistory(
                    user_id=user.id,
                    month_index=idx+1,
                    income_amount=inc.amount,
                    status=inc.status
                )
                db.add(db_inc)
            db.commit()

    # Update existing user profile with calculated premium and deferred period
    user.premium = req.premium
    user.deferred_period = req.deferred_period
    db.commit()
    db.refresh(user)


    # Use exact history provided
    income_history_data = [
        {"amount": inc.amount, "status": inc.status, "category": inc.category}
        for inc in req.income_history
    ]

    w_emp = 1.1 if user.employment_type == "SRC_Teacher" else 1.0

    result = engine.calculate_metrics(
        income_history=income_history_data,
        src_cap=user.src_cap,
        current_income=req.current_income,
        w_emp=w_emp,
        transaction_count=req.transaction_count,
        sector_dip=req.sector_dip,
        squad_no_claim_bonus=req.squad_no_claim_bonus,
        severe_weather_event=req.severe_weather_event
    )

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "employment_type": user.employment_type,
            "src_cap": user.src_cap
        },
        "evaluation": result,
        "income_history": income_history_data
    }

class WebhookPayload(BaseModel):
    user_id: int
    amount: float
    transaction_type: str
    timestamp: str

@app.post("/webhook/daraja")
def daraja_webhook(payload: WebhookPayload, db: Session = Depends(get_db)):
    """
    Simulated Webhook to receive real-time transactional data from Open Banking or Telco (e.g. Safaricom Daraja).
    Instead of relying on PDF uploads, data streams directly into the engine, updating transaction velocity and the user's risk profile dynamically.
    """
    # Logic to record the transaction, increment velocity_score, and deduct the micro-premium percentage.
    return {"status": "success", "message": "Transaction recorded for Velocity Scoring. Micro-premium automatically deducted."}

@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    """ IDCS AI Copilot Module """
    user_prompt = req.messages[-1].get("content", "").lower()
    
    # Simple simulated Copilot intelligence
    if "velocity" in user_prompt or "improve" in user_prompt:
        response = "IDCS Copilot: I noticed your transaction velocity is decent, but 60% of your earnings occur on weekends. Try working Thursday nights to boost your velocity score above 90. This will upgrade you to Level 3 and reduce your micro-premium deduction!"
    elif "squad" in user_prompt or "trust" in user_prompt:
        response = "IDCS Copilot: Joining a Trust Squad is highly recommended. If you and 4 peers maintain zero suspicious claims for a year, your micro-premium rate will drop by 0.3%."
    else:
        response = "IDCS Copilot: I am your proactive financial advisor. I monitor your daily transaction flows to help you stabilize your income before a dip occurs. How can I help you optimize your business today?"
        
    return {
        "content": response
    }
