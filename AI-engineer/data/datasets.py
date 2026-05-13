import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import string
import os

def generate_zovu_ecosystem(n_traders=1000, n_seekers=5000, n_jobs=15000, n_tx=50000):
    """
    Generates the COMPLETE ZOVU data ecosystem.
    Updated: Transactions now include 'Pending' status for realistic payment lifecycles.
    """
    
    # --- 1. CONFIGURATION & POOLS ---
    LOCATIONS = ["Mile 12", "Mushin", "Balogun", "Oshodi", "Alaba", "Idumota", "Ketu"]
    LANGUAGES = ["English", "Yoruba", "Igbo", "Hausa", "Pidgin"]
    SKILLS = ["Logistics", "Sales", "Heavy Lifting", "Stock Counting", "Packaging", "Driving"]
    BIZ_TYPES = ["Wholesaler", "Retailer", "Small Kiosk", "Online Vendor"]
    JOB_TYPES = ["Full-time", "Part-time", "On-call", "One-off"]
    CONTEXTS = ["Normal", "Normal", "Normal", "Rainy_Day", "Fuel_Scarcity"]
    SHIELD_TRADER = ["None", "Bronze", "Silver", "Gold"]
    SHIELD_SEEKER = ["None", "Personal", "Family"]
    SAVINGS_GOALS = ["Shop Rent", "Restock Bulk", "School Fees", "Emergency Fund", "Equipment"]
    
    FIRST_NAMES = ["Tunde", "Chinedu", "Aminu", "Funke", "Blessing", "Ifeanyi", "Zainab", "Abubakar", "Chioma", "Emeka", "Bolanle", "Aisha", "Ibrahim", "Nneka", "Joshua", "Mary", "Kelechi", "Olumide", "Sadiq", "Folashade"]
    LAST_NAMES = ["Okoro", "Adeyemi", "Abubakar", "Chukwu", "Bello", "Nwosu", "Danjuma", "Eze", "Abiola", "Ibrahim", "Okonkwo", "Suleiman", "Balogun", "Uba", "Yusuf", "Adebayo"]
    BIZ_SUFFIXES = ["Wholesale", "Retail", "Ventures", "Global", "Hub", "Enterprises", "Stall"]
    TRADER_PREFIXES = ["Mama", "Baba", "Alhaji", "Sister", "Brother", "Madam"]

    # --- 2. IDENTITY HELPERS ---
    def gen_11_digit(): return "".join([str(random.randint(0, 9)) for _ in range(11)])
    def gen_phone(): return "0" + "".join([str(random.randint(0, 9)) for _ in range(10)])
    def gen_squad_ref(): return "SQ-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=12))
    def gen_99_acc(): return f"99{random.randint(10000000, 99999999)}"

    print(f"🚀 Generating ZOVU Master Data (v3.3 - Transaction Lifecycles)...")

    # --- 3. TRADERS GENERATION ---
    traders = []
    for i in range(n_traders):
        t_id = f"T_{100000 + i}"
        f_name, l_name = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
        biz_name = f"{random.choice(TRADER_PREFIXES)} {f_name}'s {random.choice(BIZ_SUFFIXES)}"
        b_type = random.choice(BIZ_TYPES)
        total_rev_monthly = round(random.uniform(150000, 2500000), 2)
        total_tx_monthly = random.randint(200, 1500)
        pulse_score = round(random.uniform(0.0, 100.0), 1)
        limit_mult = 2.0 if pulse_score > 85 else 1.0 if pulse_score > 70 else 0.4 if pulse_score > 40 else 0.0
        created_at = datetime.now() - timedelta(days=random.randint(90, 365))

        traders.append({
            'trader_id': t_id,
            'squad_account_number': gen_99_acc(),
            'business_name': biz_name,
            'business_type': b_type,
            'first_name': f_name,
            'last_name': l_name,
            'email': f"{f_name.lower()}.{l_name.lower()}{random.randint(1,99)}@gmail.com",
            'phone_number': gen_phone(),
            'location': random.choice(LOCATIONS),
            'primary_language': random.choice(LANGUAGES),
            'nin_number': gen_11_digit(),
            'bvn_number': gen_11_digit(),
            'total_revenue_monthly': total_rev_monthly,
            'total_transactions_monthly': total_tx_monthly,
            'average_monthly_revenue': round(total_rev_monthly / total_tx_monthly, 2),
            'ajo_savings_balance': round(total_rev_monthly * random.uniform(0.05, 0.2), 2),
            'ajo_goal_amount': round(total_rev_monthly * 1.5, -3),
            'ajo_consistency_score': round(random.uniform(0.3, 1.0), 2),
            'zovu_pulse_score': pulse_score,
            'max_credit_limit': round(total_rev_monthly * limit_mult, -2),
            'shield_status': random.choice(SHIELD_TRADER),
            'created_at': created_at,
            'updated_at': created_at + timedelta(days=random.randint(1, 30))
        })
    traders_df = pd.DataFrame(traders)

    # --- 4. SEEKERS GENERATION ---
    seekers = []
    for i in range(n_seekers):
        s_id = f"S_{500000 + i}"
        f_name, l_name = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
        created_at = datetime.now() - timedelta(days=random.randint(30, 200))

        seekers.append({
            'seeker_id': s_id,
            'squad_account_number': gen_99_acc(),
            'first_name': f_name,
            'last_name': l_name,
            'email': f"{f_name.lower()}.{l_name.lower()}{random.randint(10,999)}@gmail.com",
            'phone_number': gen_phone(),
            'location': random.choice(LOCATIONS),
            'languages_spoken': random.sample(LANGUAGES, k=random.randint(1, 3)),
            'skills_list': random.sample(SKILLS, k=random.randint(1, 2)),
            'zovu_pulse_score': round(random.uniform(0.0, 100.0), 1),
            'trust_score': round(random.uniform(0.0, 1.0), 2),
            'punctuality_index': round(random.uniform(0.0, 1.0), 2),
            'completion_rate': round(random.uniform(0.0, 1.0), 2),
            'ajo_savings_balance': round(random.uniform(1000, 50000), 2),
            'auto_save_pct': random.choice([0.0, 0.05, 0.10, 0.15]),
            'shield_status': random.choice(SHIELD_SEEKER),
            'emergency_contact_phone': gen_phone(),
            'created_at': created_at,
            'updated_at': created_at + timedelta(days=random.randint(1, 15))
        })
    seekers_df = pd.DataFrame(seekers)

    # --- 5. TRANSACTIONS GENERATION ---
    transactions = []
    TRADER_TX_TYPES = [('Sale_Inflow', 0.60), ('Ajo_Contribution', 0.10), ('Shield_Premium', 0.05), ('Health_Insurance_Premium', 0.05), ('Loan_Disbursement', 0.02), ('Loan_Repayment', 0.08), ('Job_Payout_Debit', 0.10)]
    SEEKER_TX_TYPES = [('Job_Payout_Inflow', 0.50), ('Ajo_Contribution', 0.15), ('Accident_Cover_Premium', 0.10), ('Health_Insurance_Premium', 0.10), ('Loan_Disbursement', 0.05), ('Loan_Repayment', 0.10)]

    for i in range(n_tx):
        is_trader = random.random() < 0.4
        user = traders_df.sample(1).iloc[0] if is_trader else seekers_df.sample(1).iloc[0]
        u_id = user['trader_id'] if is_trader else user['seeker_id']
        
        pool = TRADER_TX_TYPES if is_trader else SEEKER_TX_TYPES
        cats, weights = zip(*pool)
        cat = random.choices(cats, weights=weights)[0]
        
        # Amount Logic
        if cat == 'Sale_Inflow': amt = random.uniform(2000, 45000)
        elif 'Premium' in cat or 'Cover' in cat: amt = random.uniform(500, 5000)
        elif 'Contribution' in cat: amt = random.uniform(1000, 10000)
        elif 'Disbursement' in cat: amt = random.uniform(20000, 100000)
        elif 'Repayment' in cat: amt = random.uniform(5000, 15000)
        else: amt = random.uniform(2000, 8000)
        
        # STATUS LOGIC (Updated to include Pending)
        status_roll = random.random()
        if status_roll > 0.10: status = 'Success'
        elif status_roll > 0.04: status = 'Pending'
        else: status = 'Failed'
        
        ts = datetime.now() - timedelta(days=random.randint(1, 90))
        transactions.append({
            'tx_id': f"TX_{i:06d}",
            'squad_ref': gen_squad_ref(),
            'user_id': u_id,
            'category': cat,
            'amount_gross': round(amt, 2),
            'status': status,
            'economic_context': random.choice(CONTEXTS),
            'timestamp': ts,
            'updated_at': ts + timedelta(minutes=random.randint(1, 30))
        })
    tx_df = pd.DataFrame(transactions)

    # --- 6. JOBS GENERATION ---
    jobs = []
    for i in range(n_jobs):
        t, s = traders_df.sample(1).iloc[0], seekers_df.sample(1).iloc[0]
        j_type = random.choice(JOB_TYPES)
        created = datetime.now() - timedelta(days=random.randint(1, 90))
        jobs.append({
            'job_id': f"JOB_{i:05d}",
            'trader_id': t['trader_id'],
            'seeker_id': s['seeker_id'],
            'job_type': j_type,
            'skill_required': random.choice(SKILLS),
            'status': 'Paid',
            'trader_rating': random.randint(1, 5),
            'seeker_rating': random.randint(1, 5),
            'amount_paid': round(random.uniform(2000, 12000), 2),
            'economic_context': random.choice(CONTEXTS),
            'created_at': created,
            'updated_at': created + timedelta(hours=random.randint(4, 24))
        })
    jobs_df = pd.DataFrame(jobs)

    # --- 7. EXPORT ---
    if not os.path.exists('data'): os.makedirs('data')
    traders_df.to_csv('data/traders_final.csv', index=False)
    seekers_df.to_csv('data/seekers_final.csv', index=False)
    tx_df.to_csv('data/transactions_final.csv', index=False)
    jobs_df.to_csv('data/jobs_final.csv', index=False)
    
    print("\n✅ Data Ecosystem Updated. Transactions now support Success, Pending, and Failed states.")

if __name__ == "__main__":
    generate_zovu_ecosystem()