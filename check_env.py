import sys
import os
import importlib

def check_imports():
    libraries = [
        "pandas",
        "pdfplumber",
        "streamlit",
        "pydantic",
        "google.generativeai"
    ]
    
    print("--- IDCS Environment Check ---")
    print(f"Python Path: {sys.executable}")
    print(f"Current Directory: {os.getcwd()}\n")
    
    missing = []
    for lib in libraries:
        try:
            importlib.import_module(lib)
            print(f" {lib}: Found")
        except ImportError:
            print(f" {lib}: MISSING")
            missing.append(lib)
            
    if not missing:
        print("\n All critical libraries are correctly installed!")
    else:
        print(f"\n Missing {len(missing)} libraries. Please run: pip install -r requirements.txt")

if __name__ == "__main__":
    check_imports()
