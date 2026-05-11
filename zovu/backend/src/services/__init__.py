"""Services package."""
from src.services.auth import AuthService
from src.services.credit import CreditService
from src.services.loan import LoanService
from src.services.squad import SquadService
from src.services.pulse_score import PulseScoreService
from src.services.ajo import AjoService
from src.services.referral import ReferralService
from src.services.fraud import FraudService

__all__ = [
    "AuthService",
    "CreditService",
    "LoanService",
    "SquadService",
    "PulseScoreService",
    "AjoService",
    "ReferralService",
    "FraudService",
]
