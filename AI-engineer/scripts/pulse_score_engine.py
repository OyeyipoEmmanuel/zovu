import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class ZovuPulseEngine:
    """
    ZOVU Pulse Score Engine (v2.2)
    Calculates behavioral creditworthiness for both Traders and Seekers.
    Updated: Volume benchmark now uses 'total_revenue_monthly' (Historical Volume)
    instead of 'average_monthly_revenue' (Ticket Size).
    """

    def __init__(self, transactions_df, jobs_df, traders_df, seekers_df):
        self.tx = transactions_df
        self.jobs = jobs_df
        self.traders = traders_df
        self.seekers = seekers_df
        
        # Ensure timestamps are in datetime format
        self.tx['timestamp'] = pd.to_datetime(self.tx['timestamp'])
        if 'updated_at' in self.jobs.columns:
            self.jobs['updated_at'] = pd.to_datetime(self.jobs['updated_at'])

    def calculate_trader_score(self, trader_id, lookback_days=30):
        """
        Calculates the Trader Pulse Score (Ps_t).
        Pillars: Consistency (35%), Volume (25%), Discipline (20%), Reputation (20%)
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=lookback_days)
        
        # 1. Filter Trader Data
        t_tx = self.tx[(self.tx['user_id'] == trader_id) & (self.tx['timestamp'] >= start_date)]
        t_jobs = self.jobs[(self.jobs['trader_id'] == trader_id) & (self.jobs['status'].isin(['Completed', 'Paid']))]
        profile = self.traders[self.traders['trader_id'] == trader_id]

        if profile.empty: return {"error": "Trader not found"}
        if t_tx.empty: return {"id": trader_id, "pulse_score": 0.0, "tier": "None", "Note": "New Trader"}

        # --- PILLAR 1: Consistency (35%) ---
        # Logic: Frequency of active sales days
        active_days = t_tx[t_tx['category'] == 'Sale_Inflow']['timestamp'].dt.date.nunique()
        c_score = (active_days / lookback_days) * 100
        
        # --- PILLAR 2: Volume (25%) ---
        # Logic: Actual revenue vs the trader's historical monthly total volume.
        # FIX: Changed from average_monthly_revenue (ticket size) to total_revenue_monthly (volume benchmark)
        target_vol_benchmark = profile['total_revenue_monthly'].values[0]
        actual_rev = t_tx[t_tx['category'] == 'Sale_Inflow']['amount_gross'].sum()
        v_score = min((actual_rev / target_vol_benchmark) * 100, 100) if target_vol_benchmark > 0 else 50.0

        # --- PILLAR 3: Discipline (20%) ---
        # Logic: Success rate of Ajo, Shield, and Health recurring payments
        recurring = t_tx[t_tx['category'].isin(['Ajo_Contribution', 'Shield_Premium', 'Health_Insurance_Premium'])]
        d_score = (len(recurring[recurring['status'] == 'Success']) / len(recurring) * 100) if not recurring.empty else 70.0

        # --- PILLAR 4: Reputation (20%) ---
        # Logic: Ratings given to the trader by Seeker labor
        r_score = (t_jobs['trader_rating'].mean() / 5 * 100) if not t_jobs.empty else 75.0

        # --- CONTEXTUAL MULTIPLIER ---
        # Resilience Bonus for trading during Rainy Days
        multiplier = 1.10 if not t_tx[t_tx['economic_context'] == 'Rainy_Day'].empty else 1.0
        
        final_score = min(((c_score * 0.35) + (v_score * 0.25) + (d_score * 0.20) + (r_score * 0.20)) * multiplier, 100)
        
        return {
            "user_id": trader_id,
            "pulse_score": round(final_score, 2),
            "tier": "Gold" if final_score >= 76 else "Silver" if final_score >= 46 else "Bronze",
            "type": "Trader",
            "breakdown": {
                "consistency": round(c_score, 1),
                "volume_vs_benchmark": round(v_score, 1),
                "discipline": round(d_score, 1),
                "reputation": round(r_score, 1)
            }
        }

    def calculate_seeker_score(self, seeker_id, lookback_days=30):
        """
        Calculates the Seeker Pulse Score (Ps_s).
        Pillars: Completion (40%), Punctuality (20%), Discipline (20%), Trust (20%)
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=lookback_days)
        
        s_tx = self.tx[(self.tx['user_id'] == seeker_id) & (self.tx['timestamp'] >= start_date)]
        s_jobs = self.jobs[(self.jobs['seeker_id'] == seeker_id) & (self.jobs['updated_at'] >= start_date)]
        profile = self.seekers[self.seekers['seeker_id'] == seeker_id]

        if profile.empty: return {"error": "Seeker not found"}
        if s_jobs.empty: return {"id": seeker_id, "pulse_score": 0.0, "tier": "None", "note": "New professional"}

        # Pillar 1: Completion (40%) - Success rate of assigned jobs
        completed = len(s_jobs[s_jobs['status'].isin(['Completed', 'Paid'])])
        comp_score = (completed / len(s_jobs)) * 100

        # Pillar 2: Punctuality (20%) - From historical index
        punct_score = profile['punctuality_index'].values[0] * 100

        # Pillar 3: Financial Discipline (20%) - Seeker-Shield and Ajo success
        recurring = s_tx[s_tx['category'].isin(['Ajo_Contribution', 'Accident_Cover_Premium'])]
        d_score = (len(recurring[recurring['status'] == 'Success']) / len(recurring) * 100) if not recurring.empty else 80.0

        # Pillar 4: Peer Trust (20%) - Average rating from Traders
        trust_score = (s_jobs['seeker_rating'].mean() / 5 * 100) if not s_jobs.empty else 70.0

        final_score = (comp_score * 0.40) + (punct_score * 0.20) + (d_score * 0.20) + (trust_score * 0.20)
        
        return {
            "user_id": seeker_id,
            "pulse_score": round(min(final_score, 100), 2),
            "tier": "Gold" if final_score >= 80 else "Silver" if final_score >= 50 else "Bronze",
            "type": "Seeker",
            "unlocked_advance": round(profile['total_earned_to_date'].values[0] * 0.15, -2) if final_score > 60 else 0
        }
        
        
        
        # --- 4. Testing the Code ---


# Sample DataFrames for testing

# transactions_df
transactions_data = {
    'user_id': ['trader_1', 'trader_1', 'trader_1', 'trader_1', 'trader_1', 'trader_1', 'trader_1', 'trader_1',
                'seeker_1', 'seeker_1', 'seeker_1'],
    'timestamp': [datetime.now() - timedelta(days=5),
                  datetime.now() - timedelta(days=4),
                  datetime.now() - timedelta(days=3),
                  datetime.now() - timedelta(days=2),
                  datetime.now() - timedelta(days=2),
                  datetime.now() - timedelta(days=1),
                  datetime.now() - timedelta(days=1),
                  datetime.now() - timedelta(days=0),
                  datetime.now() - timedelta(days=7),
                  datetime.now() - timedelta(days=6),
                  datetime.now() - timedelta(days=5)],
    'category': ['Sale_Inflow', 'Sale_Inflow', 'Ajo_Contribution', 'Shield_Premium', 'Sale_Inflow', 'Sale_Inflow', 'Health_Insurance_Premium', 'Sale_Inflow',
                 'Ajo_Contribution', 'Accident_Cover_Premium', 'Ajo_Contribution'],
    'amount_gross': [100.0, 150.0, 50.0, 30.0, 200.0, 120.0, 40.0, 80.0,
                     60.0, 25.0, 70.0],
    'status': ['Success', 'Success', 'Success', 'Success', 'Success', 'Success', 'Failed', 'Success',
               'Success', 'Success', 'Success'],
    'economic_context': ['Normal', 'Normal', 'Normal', 'Rainy_Day', 'Normal', 'Normal', 'Normal', 'Rainy_Day',
                         'Normal', 'Normal', 'Normal']
}
transactions_df = pd.DataFrame(transactions_data)

# jobs_df
jobs_data = {
    'job_id': [1, 2, 3, 4],
    'trader_id': ['trader_1', 'trader_1', 'trader_2', 'trader_1'],
    'seeker_id': ['seeker_1', 'seeker_1', 'seeker_2', 'seeker_1'],
    'status': ['Completed', 'Paid', 'Completed', 'In Progress'],
    'trader_rating': [4.0, 5.0, np.nan, 3.0],
    'seeker_rating': [4.5, 3.5, np.nan, 4.0],
    'updated_at': [datetime.now() - timedelta(days=10),
                   datetime.now() - timedelta(days=8),
                   datetime.now() - timedelta(days=5),
                   datetime.now() - timedelta(days=1)]
}
jobs_df = pd.DataFrame(jobs_data)

# traders_df
traders_data = {
    'trader_id': ['trader_1', 'trader_2'],
    'total_revenue_monthly': [1000.0, 1500.0] # This is the volume benchmark
}
traders_df = pd.DataFrame(traders_data)

# seekers_df
seekers_data = {
    'seeker_id': ['seeker_1', 'seeker_2'],
    'punctuality_index': [0.85, 0.70],
    'total_earned_to_date': [5000.0, 3000.0]
}
seekers_df = pd.DataFrame(seekers_data)

# Instantiate the ZovuPulseEngine
engine = ZovuPulseEngine(transactions_df, jobs_df, traders_df, seekers_df)

print("Sample DataFrames created and ZovuPulseEngine instantiated.")




def convert_np_floats_in_dict(obj):
    """Recursively converts numpy float types in a dictionary or list to Python floats."""
    if isinstance(obj, dict):
        return {k: convert_np_floats_in_dict(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_np_floats_in_dict(elem) for elem in obj]
    elif isinstance(obj, np.float64):
        return float(obj)
    return obj

# Calculate scores
trader_id_to_test = 'trader_1'
trader_score = engine.calculate_trader_score(trader_id_to_test)

seeker_id_to_test = 'seeker_1'
seeker_score = engine.calculate_seeker_score(seeker_id_to_test)

# Convert numpy floats to standard floats for clean printing
trader_score_cleaned = convert_np_floats_in_dict(trader_score)
seeker_score_cleaned = convert_np_floats_in_dict(seeker_score)

# Display Trader Pulse Score
print(f"\nTrader Pulse Score for {trader_id_to_test}:")
print(trader_score_cleaned)

# Display Seeker Pulse Score
print(f"\nSeeker Pulse Score for {seeker_id_to_test}:")
print(seeker_score_cleaned)