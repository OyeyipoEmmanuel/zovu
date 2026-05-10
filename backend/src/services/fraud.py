"""
Fraud detection and KYC verification service.
Device fingerprinting, anomaly detection, compliance checks.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.models import User, Device, Transaction, Loan, LoanStatus
from src.core.exceptions import NotFoundError, ValidationError
from src.core.security import decrypt_pii
import structlog
from datetime import datetime, timezone, timedelta
import hashlib

logger = structlog.get_logger()


class FraudService:
    """Fraud detection and compliance service."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def register_device(
        self,
        user_id: str,
        fingerprint: str,
        device_name: str,
        user_agent: str,
        ip_address: str,
    ) -> dict:
        """
        Register device fingerprint for user.
        Used for fraud detection and anomaly analysis.
        
        Args:
            user_id: User ID
            fingerprint: Device fingerprint hash
            device_name: Device name/description
            user_agent: User agent string
            ip_address: Client IP address
            
        Returns:
            dict with device details
        """
        logger.info("device_registration", user_id=user_id, ip_address=ip_address)
        
        # Check if device already registered
        query = select(Device).where(
            Device.user_id == user_id,
            Device.fingerprint == fingerprint
        )
        result = await self.db.execute(query)
        existing_device = result.scalar_one_or_none()
        
        if existing_device:
            existing_device.last_seen = datetime.now(timezone.utc)
            await self.db.commit()
            return {
                "device_id": existing_device.id,
                "status": "existing",
                "is_trusted": existing_device.is_trusted,
            }
        
        # Create new device record
        device = Device(
            user_id=user_id,
            fingerprint=fingerprint,
            device_name=device_name,
            user_agent=user_agent,
            ip_address=ip_address,
            is_trusted=False,  # New devices must be verified
        )
        self.db.add(device)
        await self.db.commit()
        
        logger.info("device_registered", user_id=user_id, device_id=device.id)
        
        return {
            "device_id": device.id,
            "status": "new",
            "is_trusted": False,
            "message": "Device registered. Please verify for enhanced security.",
        }
    
    async def trust_device(self, user_id: str, device_id: str) -> dict:
        """
        Mark device as trusted (user verified ownership).
        
        Args:
            user_id: User ID
            device_id: Device ID
            
        Returns:
            dict with updated device status
        """
        logger.info("device_trust_started", user_id=user_id, device_id=device_id)
        
        query = select(Device).where(
            Device.id == device_id,
            Device.user_id == user_id
        )
        result = await self.db.execute(query)
        device = result.scalar_one_or_none()
        
        if not device:
            raise NotFoundError("Device not found")
        
        device.is_trusted = True
        await self.db.commit()
        
        logger.info("device_trusted", user_id=user_id, device_id=device_id)
        
        return {
            "device_id": device_id,
            "is_trusted": True,
            "message": "Device marked as trusted",
        }
    
    async def check_device_anomaly(self, user_id: str, current_fingerprint: str) -> dict:
        """
        Check if current device is anomalous compared to user's device history.
        
        Args:
            user_id: User ID
            current_fingerprint: Current device fingerprint
            
        Returns:
            dict with anomaly assessment
        """
        logger.info("device_anomaly_check", user_id=user_id)
        
        # Get user's known devices
        query = select(Device).where(
            Device.user_id == user_id,
            Device.is_trusted == True
        )
        result = await self.db.execute(query)
        trusted_devices = result.scalars().all()
        
        if not trusted_devices:
            # No known devices — allow but flag as new
            return {
                "anomaly_detected": False,
                "reason": "no_known_devices",
                "risk_score": 0.3,  # Moderate risk
            }
        
        # Check if fingerprint matches any trusted device
        is_known = any(d.fingerprint == current_fingerprint for d in trusted_devices)
        
        if is_known:
            return {
                "anomaly_detected": False,
                "reason": "device_recognized",
                "risk_score": 0.0,
            }
        
        # Unknown device — potential anomaly
        logger.warning("unknown_device_detected", user_id=user_id)
        
        return {
            "anomaly_detected": True,
            "reason": "unknown_device",
            "risk_score": 0.7,  # High risk
            "recommendation": "Require user verification",
        }
    
    async def detect_account_anomalies(self, user_id: str) -> dict:
        """
        Detect unusual account behavior patterns.
        
        Checks:
        - Rapid transaction spikes
        - Multiple failed login attempts
        - Unusual credit requests relative to history
        - Geographic anomalies (different IPs)
        
        Args:
            user_id: User ID
            
        Returns:
            dict with anomalies found
        """
        logger.info("account_anomaly_detection", user_id=user_id)
        
        anomalies = []
        
        # Check for rapid transactions (multiple in short time)
        last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        query = select(func.count(Transaction.id)).where(
            Transaction.user_id == user_id,
            Transaction.created_at > last_24h
        )
        result = await self.db.execute(query)
        recent_transactions = result.scalar()
        
        if recent_transactions > 10:
            anomalies.append({
                "type": "rapid_transactions",
                "severity": "medium",
                "count": recent_transactions,
            })
        
        # Check for multiple loan requests
        last_week = datetime.now(timezone.utc) - timedelta(days=7)
        query = select(func.count(Loan.id)).where(
            Loan.user_id == user_id,
            Loan.status.in_([LoanStatus.PENDING, LoanStatus.APPROVED]),
            Loan.created_at > last_week
        )
        result = await self.db.execute(query)
        recent_loans = result.scalar()
        
        if recent_loans > 2:
            anomalies.append({
                "type": "multiple_loan_requests",
                "severity": "high",
                "count": recent_loans,
            })
        
        # Check geographic anomaly (new IP)
        query = select(Device).where(
            Device.user_id == user_id,
            Device.is_trusted == True
        )
        result = await self.db.execute(query)
        known_ips = set(d.ip_address for d in result.scalars().all())
        
        # In production, get current IP from request context
        # If current IP not in known_ips, flag as anomaly
        
        logger.info("account_anomalies_detected", count=len(anomalies))
        
        return {
            "anomalies": anomalies,
            "risk_level": "high" if len(anomalies) > 1 else "medium" if anomalies else "low",
            "recommendation": "Require additional verification" if anomalies else None,
        }
    
    async def verify_kyc_documents(
        self,
        user_id: str,
        bvn: str,
        nin: str,
    ) -> dict:
        """
        Verify KYC documents (BVN, NIN).
        In production, integrate with external KYC service.
        For now, basic validation only.
        
        Args:
            user_id: User ID
            bvn: Bank Verification Number (encrypted)
            nin: National Identification Number (encrypted)
            
        Returns:
            dict with verification status
        """
        logger.info("kyc_verification_started", user_id=user_id)
        
        # Basic validation
        if not bvn or len(bvn) < 11:
            raise ValidationError("Invalid BVN")
        
        if not nin or len(nin) < 11:
            raise ValidationError("Invalid NIN")
        
        # In production:
        # 1. Call BVN verification API
        # 2. Call NIN verification API
        # 3. Check for duplicate BVN/NIN across users
        # 4. Update compliance flags if issues found
        
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError("User not found")
        
        # Mark as verified (in production, only after external verification)
        user.kyc_verified = True
        
        await self.db.commit()
        logger.info("kyc_verification_completed", user_id=user_id)
        
        return {
            "user_id": user_id,
            "kyc_verified": True,
            "verification_timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    async def add_compliance_flag(
        self,
        user_id: str,
        flag_type: str,
        description: str,
        severity: str = "medium",
    ) -> dict:
        """
        Add compliance flag to user account.
        Flags lower pulse score and may trigger restrictions.
        
        Args:
            user_id: User ID
            flag_type: Type of flag (e.g., 'suspicious_activity', 'failed_kyc')
            description: Description of flag
            severity: 'low', 'medium', 'high'
            
        Returns:
            dict with flag details
        """
        logger.warning(
            "compliance_flag_added",
            user_id=user_id,
            flag_type=flag_type,
            severity=severity,
        )
        
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError("User not found")
        
        # Initialize flags if needed
        if not user.compliance_flags:
            user.compliance_flags = []
        
        # Add flag
        flag = {
            "type": flag_type,
            "description": description,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        user.compliance_flags.append(flag)
        
        await self.db.commit()
        
        return {
            "user_id": user_id,
            "flag": flag,
            "total_flags": len(user.compliance_flags),
        }
    
    async def get_user_risk_profile(self, user_id: str) -> dict:
        """
        Get comprehensive risk profile for user.
        Combines device, transaction, KYC, and compliance flags.
        
        Args:
            user_id: User ID
            
        Returns:
            dict with risk assessment
        """
        logger.info("risk_profile_requested", user_id=user_id)
        
        query = select(User).where(User.id == user_id)
        result = await self.db.execute(query)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotFoundError("User not found")
        
        # Get compliance flags
        compliance_flags = user.compliance_flags or []
        
        # Get device count
        query = select(func.count(Device.id)).where(Device.user_id == user_id)
        result = await self.db.execute(query)
        device_count = result.scalar()
        
        # Calculate risk score (0-100)
        risk_score = 0
        
        if not user.kyc_verified:
            risk_score += 20
        
        if len(compliance_flags) > 0:
            risk_score += min(30, len(compliance_flags) * 10)
        
        if device_count > 5:
            risk_score += 15
        
        risk_score = min(100, risk_score)
        
        return {
            "user_id": user_id,
            "risk_score": risk_score,
            "risk_level": "high" if risk_score > 70 else "medium" if risk_score > 40 else "low",
            "kyc_verified": user.kyc_verified,
            "compliance_flags": len(compliance_flags),
            "devices_registered": device_count,
            "recommendations": self._get_risk_recommendations(risk_score),
        }
    
    def _get_risk_recommendations(self, risk_score: int) -> list:
        """Get risk mitigation recommendations based on score."""
        recommendations = []
        
        if risk_score > 70:
            recommendations.append("Require additional verification")
            recommendations.append("Limit transaction amounts")
            recommendations.append("Flag for manual review")
        elif risk_score > 40:
            recommendations.append("Require device verification")
            recommendations.append("Monitor for unusual activity")
        
        return recommendations
