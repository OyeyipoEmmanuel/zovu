import pandas as pd

class ZovuProductRecommender:
    """
    ZOVU AI Product Recommender
    Matches Traders and Seekers to the most relevant financial products 
    (Insurance, Loans, HMOs) based on their Pulse Score and Context.
    """

    def __init__(self, products_df):
        """
        Initializes with the active product catalog.
        """
        self.products = products_df

    def _get_user_tier(self, pulse_score):
        """Maps numeric score to product eligibility tiers."""
        if pulse_score >= 76:
            return "Gold"
        elif pulse_score >= 46:
            return "Silver"
        else:
            return "Bronze"

    def _is_eligible(self, user_tier, product_tier):
        """Checks if the user's tier meets or exceeds the product's required tier."""
        tier_hierarchy = {"Bronze": 1, "Silver": 2, "Gold": 3}
        return tier_hierarchy.get(user_tier, 0) >= tier_hierarchy.get(product_tier, 1)

    def get_recommendations(self, user_profile, pulse_score, limit=3):
        """
        Generates personalized product recommendations.
        
        Args:
            user_profile (dict): Contains 'user_type' (Trader/Seeker), 'business_type', 'skills', etc.
            pulse_score (float): The user's current ZOVU Pulse Score.
            limit (int): Max number of recommendations to return.
        """
        user_type = user_profile.get('user_type', 'Trader')
        user_tier = self._get_user_tier(pulse_score)

        # 1. HARD FILTER: Target User & Pulse Tier Eligibility
        eligible_products = self.products[
            (self.products['target_user'].isin([user_type, 'Both'])) &
            (self.products['required_pulse_tier'].apply(lambda x: self._is_eligible(user_tier, x)))
        ].copy()

        if eligible_products.empty:
            return []

        # 2. AI CONTEXTUAL SCORING (The "Smart" Layer)
        def score_product_relevance(product):
            base_score = 1.0
            reason = "Based on your current Pulse Score."

            # --- TRADER CONTEXTS ---
            if user_type == 'Trader':
                biz_type = user_profile.get('business_type', '')
                
                # Online Vendors need Transit Insurance
                if biz_type == 'Online Vendor' and 'Transit' in product['product_name']:
                    base_score += 2.0
                    reason = "Essential for online dispatch and delivery protection."
                
                # High pulse scores should be pushed towards Expansion Capital
                elif pulse_score > 80 and 'Expansion' in product['product_name']:
                    base_score += 1.5
                    reason = "Your elite sales consistency qualifies you for maximum growth capital."
                
                # Small Kiosks need basic Fire/Market cover
                elif biz_type == 'Small Kiosk' and 'Market Starter' in product['product_name']:
                    base_score += 1.0
                    reason = "Perfect low-cost capital for daily stall restocking."

            # --- SEEKER CONTEXTS ---
            elif user_type == 'Seeker':
                skills = user_profile.get('skills', '')
                
                # Logistics/Heavy Lifters need Accident Cover
                if 'Logistics' in skills and 'Accident' in product['product_name']:
                    base_score += 2.5
                    reason = "Highly recommended to protect your income during physical logistics gigs."
                
                # High trust seekers need Transport Advances
                elif pulse_score > 60 and 'Transport' in product['product_name']:
                    base_score += 1.5
                    reason = "Unlock daily transport funds to reach high-paying gigs faster."

            # --- UNIVERSAL HEALTHCARE PUSH ---
            # If the product is Health Insurance, we always give it a slight boost
            if 'Health' in product['product_name'] or product['target_user'] == 'Both':
                base_score += 0.5
                if base_score == 1.5: # If no other reason was applied
                    reason = "Protect your health to ensure your business never stops."

            return pd.Series([base_score, reason])

        # Apply scoring logic
        eligible_products[['relevance_score', 'ai_reason']] = eligible_products.apply(score_product_relevance, axis=1)

        # 3. SORT AND FORMAT RESULTS
        top_recommendations = eligible_products.sort_values(by='relevance_score', ascending=False).head(limit)
        
        results = []
        for _, prod in top_recommendations.iterrows():
            results.append({
                "product_id": prod['product_id'],
                "provider": prod['partner_id'], # In production, join with partner_name
                "product_name": prod['product_name'],
                "premium_or_rate": f"₦{prod['cost_premium']:,.2f}" if prod['cost_premium'] > 1.0 else f"{prod['cost_premium']*100}%",
                "coverage_limit": f"₦{prod['coverage_limit']:,.2f}",
                "ai_reason": prod['ai_reason']
            })

        return results

