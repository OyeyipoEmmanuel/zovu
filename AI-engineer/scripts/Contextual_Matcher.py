import pandas as pd
import numpy as np

class ZovuSynergyMatcher:
    """
    ZOVU AI Synergy Matcher (v3.0)
    Optimizes the matching of Seekers to Traders by calculating a Synergy Score (Sy).
    Formula: Sy = (Lm * 0.35) + (Ts * 0.30) + (Pi * 0.25) + (Cr * 0.10)
    """

    def __init__(self, seekers_df):
        """
        Initializes the matcher with the available seeker pool.
        """
        self.seekers = seekers_df

    def get_matches(self, trader_profile, job_details, context='Normal'):
        """
        Finds and ranks the top seekers for a specific job posting.
        
        Args:
            trader_profile (dict): Profile of hiring trader (must contain 'primary_language')
            job_details (dict): Requirements (must contain 'location', 'skill_required')
            context (str): 'Normal', 'Rainy_Day', 'Holiday_Rush', 'Fuel_Scarcity'
        """
        
        # --- STAGE 1: HARD FILTERS (Eligibility) ---
        # 1. Location matching (Proximity)
        eligible = self.seekers[self.seekers['location'] == job_details['location']].copy()
        
        # 2. Skill matching (Capability)
        # Check if the required skill is present in the seeker's skills_list
        eligible = eligible[eligible['skills_list'].apply(lambda x: job_details['skill_required'] in x)]
        
        if eligible.empty:
            return []

        # --- STAGE 2: DYNAMIC CONTEXTUAL WEIGHTING ---
        # Base Weights per Synergy Matcher Whitepaper
        w_lang = 0.35
        w_trust = 0.30
        w_punct = 0.25
        w_comp = 0.10

        # Contextual Intelligence Logic
        if context == 'Rainy_Day':
            # Double importance of Punctuality during market rain
            w_punct *= 2.0
            # Normalize remaining weights
            total = w_lang + w_trust + w_punct + w_comp
            w_lang, w_trust, w_punct, w_comp = w_lang/total, w_trust/total, w_punct/total, w_comp/total
            
        elif context == 'Holiday_Rush':
            # Triple importance of Completion during high-volume periods
            w_comp *= 3.0
            total = w_lang + w_trust + w_punct + w_comp
            w_lang, w_trust, w_punct, w_comp = w_lang/total, w_trust/total, w_punct/total, w_comp/total

        # --- STAGE 3: SYNERGY SCORING ---
        def score_seeker(seeker):
            # A. Language Match (Lm): 1.0 for match, 0.2 for misalignment
            lm = 1.0 if trader_profile['primary_language'] in seeker['languages_spoken'] else 0.2
            
            # B. Trust Score (Ts)
            ts = seeker['trust_score']
            
            # C. Punctuality Index (Pi)
            pi = seeker['punctuality_index']
            
            # D. Completion Rate (Cr)
            cr = seeker['completion_rate']

            # Formula Calculation
            synergy_score = (lm * w_lang) + (ts * w_trust) + (pi * w_punct) + (cr * w_comp)
            return round(synergy_score, 3)

        eligible['synergy_score'] = eligible.apply(score_seeker, axis=1)
        
        # --- STAGE 4: RANKING & UI TAGS ---
        top_matches = eligible.sort_values(by='synergy_score', ascending=False).head(3)
        
        results = []
        for _, s in top_matches.iterrows():
            results.append({
                "seeker_id": s['seeker_id'],
                "name": f"{s['first_name']} {s['last_name']}",
                "synergy_score": s['synergy_score'],
                "trust_score": s['trust_score'],
                "match_tags": self._generate_match_tags(s, trader_profile, context),
                "confidence_interval": "High" if s['synergy_score'] > 0.8 else "Medium"
            })
            
        return results

    def _generate_match_tags(self, seeker, trader, context):
        """Generates semantic tags for the frontend UI matches."""
        tags = []
        if trader['primary_language'] in seeker['languages_spoken']:
            tags.append(f"{trader['primary_language']} Speaker")
        
        if context == 'Rainy_Day' and seeker['punctuality_index'] > 0.9:
            tags.append("Rain Resilient")
            
        if context == 'Holiday_Rush' and seeker['completion_rate'] > 0.95:
            tags.append("High Volume Specialist")
            
        if seeker['trust_score'] > 0.9:
            tags.append("Elite Partner")
            
        return tags

# --- PRODUCTION VALIDATION ---
if __name__ == "__main__":
    # Simulate a small Seeker Pool
    mock_seekers = pd.DataFrame([
        {
            'seeker_id': 'SKR_001', 'first_name': 'Tobi', 'last_name': 'Okon',
            'location': 'Mile 12', 'skills_list': ['Logistics', 'Heavy Lifting'],
            'languages_spoken': ['Yoruba', 'English'], 'trust_score': 0.88, 
            'punctuality_index': 0.96, 'completion_rate': 0.98
        },
        {
            'seeker_id': 'SKR_002', 'first_name': 'Emeka', 'last_name': 'Chukwu',
            'location': 'Mile 12', 'skills_list': ['Logistics'],
            'languages_spoken': ['Igbo', 'English'], 'trust_score': 0.95, 
            'punctuality_index': 0.65, 'completion_rate': 0.90
        }
    ])

    matcher = ZovuSynergyMatcher(mock_seekers)
    
    # Hiring Request
    trader_p = {'primary_language': 'Yoruba'}
    job_r = {'location': 'Mile 12', 'skill_required': 'Logistics'}

    print("--- [NORMAL MATCH] ---")
    print(matcher.get_matches(trader_p, job_r, context='Normal'))

    print("\n--- [RAINY DAY MATCH (Punctuality Pivot)] ---")
    # Tobi should pull ahead in the rain due to high punctuality (0.96 vs 0.65)
    print(matcher.get_matches(trader_p, job_r, context='Rainy_Day'))
    
    
    