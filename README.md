# IDCS: Income Deficiency Compensation System 
**A Parametric AI-Driven Insurance Engine for the Gig Economy**

![License](https://img.shields.io/badge/License-Proprietary-red.svg)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)
![Framework](https://img.shields.io/badge/Framework-Streamlit-FF4B4B.svg)

##  Project Overview
The **Income Deficiency Compensation System (IDCS)** is a specialized fintech platform designed to mitigate income volatility for Kenyan gig workers and professionals. By leveraging **Gemini 1.5 Flash** for OCR and **Facebook Prophet** for time-series forecasting, IDCS predicts income "dips" and provides a structured framework for parametric compensation.

 Built for Nairobi
From the iconic KICC to the Times Tower, IDCS is architected to understand the unique cash-flow patterns of the Nairobi market, specifically focusing on M-Pesa transaction velocity.

---
 Key Features
* **Vision-Powered Underwriting:** Uses Google Gemini to extract 6 months of financial history from M-Pesa PDFs with high precision.
* **Predictive Analytics:** Implements Facebook Prophet to plot $y$ (Income) against $ds$ (Time) to identify future "Deficiency Zones."
* **Modular Architecture:** articulate lines of clean, separated Python code for scalability and performance on low-spec hardware.
* **Glassmorphism UI:** A high-end, responsive Streamlit dashboard designed for both desktop and mobile accessibility.
* **Secure Auth:** OTP-based registration and Bcrypt password hashing to protect sensitive financial data.


 Tech Stack
* **Language:** Python 
* **Frontend:** Streamlit (Custom CSS/Glassmorphism)
* **AI/ML:** Google Generative AI (SDK), Facebook Prophet, Custom I.D.C.S underwriting AI.
* **Data Processing:** Pandas, Scikit-Learn (Min-Max Scaling)
* **OS Environment:** Zorin OS (Linux)
* **Hardware Target:** Optimisedd to run even on the slowest of devices.


 Project Structure
```text
myrepo/
├── .streamlit/             # App configuration & secrets
├── assets/                 # Optimized WebP branding & logos
├── venv/                   # Virtual environment
├── app.py                  # Main Entry Point & Session State
├── auth_logic.py           # User Authentication & OTP Flow
├── data_handler.py         # Gemini Vision OCR & Data Cleaning
├── engine_prophet.py       # Actuarial Forecasting & $y$ vs $ds$ logic
└── requirements.txt        # System Dependencies
