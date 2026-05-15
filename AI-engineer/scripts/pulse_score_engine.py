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
        
        
class ZovuSelfLearningLoop:     
    """
    ZOVU Self-Learning Loop (v1.0)
    A simple feedback mechanism for processing job completion records and updating the internal AI weights for Seekers and Traders.
    A simple feedback mechanism for processing job completion records and updating the internal AI weights for Seekers and Traders. In production, this would be triggered by the backend whenever a job is completed and rated.
    """ 
    
    
    def __init__(self, seekers_df, traders_df):
        self.seekers = seekers_df
        self.traders = traders_df
        
        # --- INTERNAL STATE (In production, this syncs with your Database/Firestore) ---
        
        # Tracks how good a seeker is at a specific skill based on past 5-star ratings.
        # Format: {seeker_id: {skill: boost_multiplier}}
        self.competency_boosts = {} 
        
        # Tracks merchants who consistently receive poor ratings from workers.
        # Format: {trader_id: "Stable" | "High_Risk"}
        self.risk_flags = {}                    
    def process_job_completion(self, job_record):
        """
        Processes a completed job and updates the internal AI weights for the involved Seeker and Trader.
        """
        s_id = job_record.get('seeker_id')
        t_id = job_record.get('trader_id')
        skill = job_record.get('skill')
        s_rating = job_record.get('seeker_rating', 3.0)
        t_rating = job_record.get('trader_rating', 3.0)

        # --- SEEKER LEARNING: Skill Mastery (Reward & Penalty) ---
        if s_id not in self.competency_boosts:
            self.competency_boosts[s_id] = {}
        
        current_boost = self.competency_boosts[s_id].get(skill, 1.0)
        
        if s_rating == 5.0:
            self.competency_boosts[s_id][skill] = min(current_boost + 0.05, 1.5)
            
        elif s_rating <= 2.0:
            self.competency_boosts[s_id][skill] = max(current_boost - 0.10, 0.5)

        # --- TRADER LEARNING: Risk Flagging ---
        if t_id not in self.risk_flags:
            self.risk_flags[t_id] = "Stable"
        
        if t_rating <= 2.0:
            self.risk_flags[t_id] = "High_Risk"
        elif t_rating >= 4.0 and self.risk_flags[t_id] == "High_Risk":
            self.risk_flags[t_id] = "Stable"
                                        
        
        
        
        
        
        
                                           
