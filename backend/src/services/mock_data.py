import csv
from datetime import datetime
from typing import List
from ..schemas.auth import TransactionResponseSchema as TransactionSchema

def get_mock_transactions(file_path: str = "zovu_transactions.csv") -> List[TransactionSchema]:
    transactions = []
    with open(file_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert Naira to Kobo
            kobo_amount = int(float(row['amount_gross']) * 100)
            # Map 'amount_gross' from CSV to 'amount' in the Schema
            row['amount'] = kobo_amount

            tx = TransactionSchema(**row)
            transactions.append(tx)
    return transactions