"""
Email templates for admin dashboard notifications.
Used by complaint, fraud, and partnership services.
"""

COMPLAINT_RESOLVED = """
Subject: Your ZOVU complaint has been resolved

Hi {first_name},

Your complaint (#{complaint_id_short}) has been {resolution_label}.

Resolution: {admin_notes}

If you have further questions, reply to this email.

— The ZOVU Support Team
"""

ACCOUNT_PAUSED = """
Subject: Your ZOVU account has been temporarily paused

Hi {first_name},

Your ZOVU account has been temporarily paused due to suspicious activity.
We take fraud prevention seriously and are investigating.

Your account will remain paused until our investigation is complete.
We'll contact you within 48 hours.

If you believe this is a mistake, reply to this email.

— The ZOVU Trust & Safety Team
"""

ACCOUNT_RESTORED = """
Subject: Your ZOVU account has been restored

Hi {first_name},

Good news — your ZOVU account has been fully restored.
You can log in and continue using the platform.

— The ZOVU Trust & Safety Team
"""

PARTNERSHIP_APPROVED = """
Subject: Your ZOVU Partnership Request Has Been Approved! 🎉

Hi {contact_person},

Your partnership request for {company_name} has been approved.
{company_name} is now live on the ZOVU platform as a {company_type} partner.

Next Steps:
1. We'll contact you within 24 hours to set up your dashboard.
2. Your partnership details are now visible to ZOVU users.

Welcome to the ZOVU family!
— The ZOVU Partnerships Team
"""

PARTNERSHIP_REJECTED = """
Subject: ZOVU Partnership Request Update

Hi {contact_person},

Thank you for your interest in partnering with ZOVU.
After review, we are unable to approve {company_name}'s partnership request at this time.

Reason: {reason}

You are welcome to reapply in the future with updated information.

— The ZOVU Partnerships Team
"""

PARTNERSHIP_RECEIVED = """
Subject: ZOVU — We've received your partnership request

Hi {contact_person},

We've received your partnership request for {company_name}.
Our team will review your application and respond within 3-5 business days.

— The ZOVU Partnerships Team
"""
