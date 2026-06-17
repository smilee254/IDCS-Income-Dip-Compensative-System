import pandas as pd # pyre-ignore[21]
import pdfplumber # pyre-ignore[21]
import io
import json
import os
import google.generativeai as genai # pyre-ignore[21]
from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, validator # pyre-ignore[21]
from datetime import datetime

# --- 1. Pydantic Models for Validation ---

class IncomeData(BaseModel):
    """Schema for individual income transaction"""
    date: str = Field(..., description="Transaction date (YYYY-MM-DD)")
    amount: float = Field(..., description="Inflow amount (Float)")
    description: str = Field(..., description="Source or Details of inflow")

    @validator('date')
    def validate_date(cls, v):
        try:
            # Flexible parsing for AI convenience
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
                try:
                    dt = datetime.strptime(v, fmt)
                    return dt.strftime("%Y-%m-%d")
                except:
                    continue
            return datetime.fromisoformat(v[:10]).strftime("%Y-%m-%d")
        except:
            raise ValueError(f"Invalid date format: {v}")

class AIInflowResult(BaseModel):
    """Root schema for AI response"""
    inflows: List[IncomeData]

# --- 2. Gemini Vision-Language Extractor ---

class IncomeVisionExtractor:
    def __init__(self):
        # Configure using st.secrets as requested
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            genai.configure(api_key=api_key)
            
            # Mission: Strictly extract IncomeData schema using structured output
            self.model = genai.GenerativeModel(
                model_name="models/gemini-2.5-flash",
                generation_config={
                    "response_mime_type": "application/json",
                    "response_schema": {
                        "type": "object",
                        "properties": {
                            "inflows": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "date": {"type": "string"},
                                        "amount": {"type": "number"},
                                        "description": {"type": "string"}
                                    },
                                    "required": ["date", "amount", "description"]
                                }
                            }
                        },
                        "required": ["inflows"]
                    }
                }
            )
        except Exception:
            self.model = None

    def extract_inflows(self, file_content: bytes, is_mpesa: bool = True, user_name: Optional[str] = None) -> List[Dict]:
        """
        Processes PDF and extracts ONLY inflows using Gemini 2.5 Flash.
        If user_name is provided, it verifies the name exists in the document text.
        """
        if not self.model:
            raise ValueError("Gemini API Key missing in environment variables")

        # Extract text for context
        full_texts: List[str] = []
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_texts.append(str(text))
        
        full_text = "\n--PAGE--\n".join(full_texts)
        
        if user_name and user_name.lower() not in full_text.lower():
            raise ValueError(f"Name Verification Failed: The uploaded document does not contain the registered user name '{user_name}'.")

        prompt = f"""
        Analyze this bank/M-Pesa statement. Identify and extract ONLY 'Money In' (Credit/Deposits). 
        Ignore all 'Debit', 'Withdrawal', or 'Sent' transactions.
        Return a JSON list with 'date', 'amount', and 'description'.
        
        DOCUMENT CONTENT:
        {full_text}"""

        try:
            response = self.model.generate_content(prompt)
            raw_text = response.text
            
            # Extract JSON block
            if "```json" in raw_text:
                raw_json = raw_text.split("```json")[1].split("```")[0].strip()
            else:
                raw_json = raw_text.strip()
            
            data = json.loads(raw_json)
            # Validate with Pydantic
            validated = AIInflowResult(**data)
            return [item.dict() for item in validated.inflows]
        except Exception as e:
            print(f"AI Vision Error: {e}")
            return []

    def summarize_data(self, raw_data: List[Dict]) -> str:
        """
        Uses Gemini to explain the extracted data in plain English.
        """
        if not self.model or not raw_data:
            return "No data available to summarize."

        prompt = f"""
        Explain this extracted financial data in plain English for a non-technical user.
        Focus on:
        1. The number of transactions found.
        2. The date range covered.
        3. The primary sources of income identified (from descriptions).
        4. Any clear patterns or major deposits.
        
        DATA:
        {json.dumps(raw_data, indent=2)}
        
        Keep the explanation helpful, transparent, and concise (max 150 words).
        """
        try:
            # Use a slightly different config for text summary (non-JSON)
            summary_model = genai.GenerativeModel(model_name="models/gemini-2.5-flash")
            response = summary_model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error generating summary: {e}"

def get_extractor():
    return IncomeVisionExtractor()

# --- 3. Data Anchoring & Monthly Aggregation ---

def process_and_group_inflows(mpesa_content: Optional[bytes] = None, bank_content: Optional[bytes] = None):
    """
    Main entry point for Dashboard.
    Groups 'amount' by month (YYYY-MM) and identifies missing months/Zero Income.
    Returns (DataFrame, monthly_inflow_dict, raw_list)
    """
    extractor = get_extractor()
    all_inflows = []

    if mpesa_content:
        all_inflows.extend(extractor.extract_inflows(mpesa_content, is_mpesa=True))
    if bank_content:
        all_inflows.extend(extractor.extract_inflows(bank_content, is_mpesa=False))

    if not all_inflows:
        return pd.DataFrame(), {}, []

    df = pd.DataFrame(all_inflows)
    df['Date'] = pd.to_datetime(df['date'])
    df['MonthYear'] = df['Date'].dt.strftime('%Y-%m')
    
    # Group by Month (YYYY-MM)
    monthly_inflow = df.groupby('MonthYear')['amount'].sum().to_dict()
    
    # Identify Missing Months (Simple range check)
    if monthly_inflow:
        min_date = df['Date'].min()
        max_date = df['Date'].max()
        full_range = pd.date_range(start=min_date, end=max_date, freq='MS').strftime('%Y-%m').tolist()
        
        for m in full_range:
            if m not in monthly_inflow:
                monthly_inflow[m] = 0.0 # 100% Dip / Zero Income flagged
                
    # Sort for predictability
    sorted_monthly = dict(sorted(monthly_inflow.items()))
    
    return df, sorted_monthly, all_inflows

def summarize_data(raw_data: List[Dict]) -> str:
    """Standalone wrapper for UI calls."""
    extractor = get_extractor()
    return extractor.summarize_data(raw_data)
