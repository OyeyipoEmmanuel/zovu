import csv
from datetime import datetime
from typing import List
from ..schemas.auth import TransactionSchema

def get_mock_transactions(file_path: str = "zovu_transactions.csv") -> List[TransactionSchema]:
    transactions = []
    with open(file_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert the amount from the CSV (Naira) to Kobo for your backend
            row['amount_gross'] = int(float(row['amount_gross']) * 100)
            
            # Pydantic handles the Date string -> datetime conversion automatically
            tx = TransactionSchema(**row)
            transactions.append(tx)
    return transactions