# ZOVU ADMIN DASHBOARD - FEATURE SPECIFICATION & IMPLEMENTATION GUIDE

**Status**: ✋ NOT STARTED - Waiting for Implementation  
**Priority**: 🔴 HIGH - Core Operations Feature  
**Estimated Effort**: 15-20 hours full stack

---

## EXECUTIVE OVERVIEW

The Admin Dashboard is a comprehensive management system for Zovu operations. Admin users oversee complaints, manage user accounts, monitor platform metrics, and approve partnership requests.

### Core Responsibilities:
1. **Complaint Management** - Investigate transactions, validate user claims
2. **Fraud Detection** - Flag suspicious accounts, pause/delete bad actors  
3. **Platform Metrics** - Track KPIs (users, businesses, partners)
4. **Partnership Management** - Review requests, approve/publish to website

### Who Uses This:
- Admin/Operations team
- Support staff (complaint handling)
- Management/Analytics (metrics viewing)
- Partnerships team (partnership requests)

---

## TABLE OF CONTENTS

1. [Feature 1: Complaint Management](#feature-1-complaint-management)
2. [Feature 2: Fraud Detection & User Management](#feature-2-fraud-detection--user-management)
3. [Feature 3: Platform Metrics Dashboard](#feature-3-platform-metrics-dashboard)
4. [Feature 4: Partnership Management](#feature-4-partnership-management)
5. [Database Schema](#database-schema)
6. [Backend Implementation](#backend-implementation)
7. [Frontend Implementation](#frontend-implementation)
8. [API Endpoints](#api-endpoints)
9. [Integration Flow](#integration-flow)
10. [Security Considerations](#security-considerations)
11. [Implementation Roadmap](#implementation-roadmap)

---

## FEATURE 1: COMPLAINT MANAGEMENT

### Overview
Admin users can view and investigate user complaints about transactions. When a complaint is lodged, the system captures transaction details and allows admin to verify if the transaction was successful or has issues.

### Problem Statement
"When user lodge complaints, We oversee transactions to confirm if it was successful or not"

### Use Cases

#### Use Case 1.1: View Complaints List
**Actor**: Admin  
**Trigger**: Admin opens Admin Dashboard → Complaints Tab

**Flow**:
1. System displays list of all complaints
2. Shows: Complainant name, transaction ID, complaint date, status, urgency
3. Admin can filter by: Status (new/investigating/resolved), Date range, User name
4. Admin can sort by: Date (newest first), Urgency, Status

**Data Displayed**:
```json
{
  "complaints": [
    {
      "id": "uuid",
      "complainant_id": "user-uuid",
      "complainant_name": "John Doe",
      "transaction_id": "txn-uuid",
      "transaction_amount": 50000,
      "transaction_date": "2026-05-10T14:23:00Z",
      "complaint_date": "2026-05-11T09:15:00Z",
      "status": "new|investigating|resolved",
      "urgency": "low|medium|high",
      "category": "transaction_failed|payment_delayed|wrong_amount|duplicate_charge",
      "description": "Transaction not received",
      "created_at": "2026-05-11T09:15:00Z"
    }
  ],
  "total": 47,
  "pagination": { "page": 1, "limit": 20 }
}
```

#### Use Case 1.2: View Complaint Details
**Actor**: Admin  
**Trigger**: Admin clicks on complaint in list

**Flow**:
1. System shows full complaint details
2. Shows transaction details:
   - From user (sender)
   - To user (recipient)
   - Amount
   - Status (completed/failed/pending)
   - Timestamp
   - Payment method
   - Squad transaction reference
3. Shows complaint details:
   - Complaint text
   - Screenshots (if uploaded)
   - Email trail
   - Previous interactions
4. Shows admin actions log (who did what, when)

**Screen Layout**:
```
┌─ Complaint #12345 ──────────────────────────────────────┐
│                                                          │
│ Status: INVESTIGATING      Urgency: HIGH                │
│                                                          │
├─ TRANSACTION DETAILS ───────────────────────────────────┤
│                                                          │
│ From: Mama Tunde (trader_001)                           │
│ To: John Doe (seeker_045)                               │
│ Amount: ₦50,000 (5,000,000 Kobo)                        │
│ Date: May 10, 2026 2:23 PM                              │
│ Status: COMPLETED ✓                                     │
│ Squad Ref: SQ-TXN-9876543                               │
│ Payment Method: Bank Transfer (GTBank)                  │
│                                                          │
├─ COMPLAINT DETAILS ─────────────────────────────────────┤
│                                                          │
│ Complaint Category: TRANSACTION_FAILED                  │
│ Complaint Text:                                         │
│   "I didn't receive the money. My account shows        │
│    nothing. But the sender claims they sent it."        │
│                                                          │
│ Evidence:
│   📸 Screenshot_1.png (105 KB)                          │
│   📸 Screenshot_2.jpg (89 KB)                           │
│                                                          │
├─ VERIFICATION ──────────────────────────────────────────┤
│                                                          │
│ ✓ Transaction Found: YES                                │
│ ✓ Squad Verified: YES (Status: COMPLETED)               │
│ ✓ Recipient Balance Changed: YES (+₦50,000)            │
│ ⚠ Recipient Claims: Didn't receive                      │
│                                                          │
├─ ADMIN ACTIONS ──────────────────────────────────────────┤
│                                                          │
│ Status Update: [Investigating ▼]                        │
│                                                          │
│ Investigation Notes:                                    │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Checked with Squad: Transaction completed.         │ │
│ │ Verified recipient account: Balance updated.       │ │
│ │ This appears to be user error or delay in their   │ │
│ │ banking app sync.                                 │ │
│ │                                                    │ │
│ │ Recommended action: Advise user to check          │ │
│ │ their bank account directly.                      │ │
│ └────────────────────────────────────────────────────┘ │
│                                                          │
│ [Mark as Resolved] [Request More Info] [Escalate]      │
│                                                          │
├─ HISTORY ───────────────────────────────────────────────┤
│                                                          │
│ May 11, 2:05 PM - Complaint Created by John Doe        │
│ May 11, 2:10 PM - Admin Sarah reviewed complaint       │
│ May 11, 2:15 PM - Changed status to INVESTIGATING      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### Use Case 1.3: Verify Transaction Status
**Actor**: Admin  
**Trigger**: Admin clicks "Verify with Squad" button

**Flow**:
1. System makes API call to Squad to check transaction status
2. Shows real-time confirmation:
   - Transaction status (completed/failed/pending)
   - Both parties' account changes
   - Payment method confirmation
   - Timestamps
3. Compares with complainant's claim
4. Generates verification report

**Verification Report Shows**:
```json
{
  "verification": {
    "transaction_found": true,
    "squad_status": "completed",
    "sender_account_debited": true,
    "sender_amount_debited": 5000000,
    "recipient_account_credited": true,
    "recipient_amount_credited": 5000000,
    "timestamp": "2026-05-10T14:23:00Z",
    "settlement_date": "2026-05-10T15:00:00Z",
    "is_successful": true,
    "mismatch_with_complaint": false
  }
}
```

#### Use Case 1.4: Update Complaint Status
**Actor**: Admin  
**Trigger**: Admin marks complaint as resolved/invalid

**Flow**:
1. Admin writes investigation notes
2. Admin selects resolution:
   - **RESOLVED**: Transaction confirmed successful, user error
   - **REFUND_ISSUED**: Real issue found, refund processed
   - **ESCALATE_TO_SUPPORT**: Needs human support
   - **FRAUD_DETECTED**: Complaint is part of fraud scheme
   - **INVALID**: User filing false complaint
3. System sends email to complainant with resolution
4. Logs action in admin audit trail

**Example Resolutions**:
```
RESOLVED: "Our investigation confirms the transaction was completed
successfully. Both sender and recipient accounts were updated. Please
check your bank account - the funds may be pending in your banking app."

REFUND_ISSUED: "We've identified a system error in your transaction.
A refund of ₦50,000 has been processed. You should see it within 24 hours."

ESCALATE_TO_SUPPORT: "This requires our support team's attention. 
An agent will contact you within 24 hours."

FRAUD_DETECTED: "This complaint is associated with a fraud investigation.
Your account has been flagged. Our compliance team will reach out."
```

---

## FEATURE 2: FRAUD DETECTION & USER MANAGEMENT

### Overview
"We manage users to see which one is flagged for scams so we delete their account or pause it."

Admin can identify suspicious users, flag them for fraud, and take action by pausing or deleting accounts.

### Problem Statement
Admin needs to:
1. Flag suspicious users
2. Pause accounts (temporary freeze)
3. Delete accounts (permanent removal)
4. Track fraud patterns
5. View fraud scores

### Use Cases

#### Use Case 2.1: View Flagged Users
**Actor**: Admin  
**Trigger**: Admin opens Admin Dashboard → Fraud Management Tab

**Flow**:
1. System displays list of flagged users
2. Shows: User name, flag reason, flag date, status, fraud risk score
3. Admin can filter by: Flag reason, Date range, Risk score (High/Medium/Low)
4. Admin can see automatic flags + manual flags

**Data Displayed**:
```json
{
  "flagged_users": [
    {
      "user_id": "uuid",
      "email": "scammer@example.com",
      "full_name": "Suspicious User",
      "user_type": "trader|seeker|lender",
      "flag_reason": "multiple_chargebacks|unusual_activity|complaint_pattern|manual_flag",
      "fraud_risk_score": 87,  // 0-100, higher = more risky
      "flag_date": "2026-05-08T10:00:00Z",
      "flagged_by": "system|admin_name",
      "account_status": "active|paused|deleted",
      "complain_count": 5,
      "chargeback_count": 3,
      "reason_details": "5 complaints filed by different users about duplicate charges",
      "last_activity": "2026-05-11T14:23:00Z"
    }
  ],
  "total": 23
}
```

#### Use Case 2.2: Flag User for Fraud
**Actor**: Admin  
**Trigger**: Admin clicks "Flag for Review" on user profile or complaint

**Flow**:
1. Admin opens "Flag User" modal
2. Selects flag reason:
   - Multiple chargebacks
   - Unusual activity pattern
   - Complaint pattern (many complaints)
   - Possible account takeover
   - Manual review required
   - Other (specify)
3. Adds investigation notes
4. System calculates fraud risk score
5. Automatically adds to fraud monitoring list

**Fraud Risk Score Calculation**:
```
Score = (complaints × 20) + (chargebacks × 15) + (failed_txns × 10) + (device_anomalies × 25)

Example:
- 5 complaints: 5 × 20 = 100
- 2 chargebacks: 2 × 15 = 30
- 8 failed transactions: 8 × 10 = 80
- 1 device anomaly: 1 × 25 = 25
Total: 235 → Normalized to 0-100 scale = 85 (HIGH RISK)
```

#### Use Case 2.3: Pause Account
**Actor**: Admin  
**Trigger**: Admin clicks "Pause Account" on flagged user

**Flow**:
1. Admin clicks "Pause Account" button
2. System shows confirmation dialog:
   - "Are you sure? User will not be able to log in."
   - "This action is reversible - you can unpause later."
3. Admin confirms + adds reason:
   - "Suspected fraud - under investigation"
   - "Too many chargebacks"
   - "Account takeover suspected"
4. System immediately:
   - Sets user status to SOFT_FROZEN
   - Revokes all active sessions
   - Prevents new logins
   - Cancels pending transactions
5. Sends email to user:
   ```
   Subject: Your Zovu Account Has Been Paused

   Your Zovu account has been temporarily paused due to suspicious activity.
   We take fraud prevention seriously and are investigating.
   
   Your account will remain paused until our investigation is complete.
   We'll contact you within 48 hours with an update.
   
   If you believe this is a mistake, please reply to this email or call [support number].
   ```

#### Use Case 2.4: Delete Account
**Actor**: Admin  
**Trigger**: Admin clicks "Delete Account" on confirmed fraudster

**Flow**:
1. Admin clicks "Delete Account" button
2. System shows WARNING:
   ```
   ⚠️ WARNING: This action is PERMANENT
   
   Deleting this account will:
   - Permanently remove all user data
   - Cancel all pending transactions
   - Close all active connections
   - This cannot be undone
   
   Reason for deletion (required):
   [Dropdown: Fraud confirmed | Violates ToS | User request | Other]
   
   [Cancel] [I Understand - Delete] 
   ```
3. Admin confirms + provides reason
4. System performs deletion:
   - Marks account as deleted
   - Anonymizes personal data
   - Cancels pending transactions
   - Logs deletion in audit trail
5. Sends email to user (if possible):
   ```
   Subject: Your Zovu Account Has Been Deleted

   Your Zovu account has been permanently deleted due to [reason].
   
   If you have outstanding debts or pending transactions, 
   you will still be held liable.
   
   For appeals or questions, contact [support email].
   ```

#### Use Case 2.5: View Fraud Analytics
**Actor**: Admin  
**Trigger**: Admin opens "Fraud Analytics" section

**Screen Displays**:
```
┌─ FRAUD ANALYTICS ─────────────────────────────────────┐
│                                                       │
│ Overview (Last 30 Days):                             │
│ • Total Flagged Users: 23                            │
│ • Accounts Paused: 8                                 │
│ • Accounts Deleted: 3                                │
│ • Active Fraud Investigations: 12                    │
│                                                       │
│ Top Fraud Reasons:                                   │
│ 1. Complaint Pattern (12 users) ██████████░░ 52%    │
│ 2. Chargebacks (6 users) ███░░░░░░░░░░░░░░░░ 26%    │
│ 3. Unusual Activity (4 users) ██░░░░░░░░░░░░░░░░░░ 17%
│ 4. Device Anomaly (1 user) ░░░░░░░░░░░░░░░░░░░░ 4%  │
│                                                       │
│ Risk Score Distribution:                             │
│ High Risk (75-100):     8 users                      │
│ Medium Risk (50-74):   12 users                      │
│ Low Risk (0-49):        3 users                      │
│                                                       │
│ Recent Actions:                                      │
│ • May 11, 2:30 PM - Paused user_123 (risk: 92)      │
│ • May 11, 1:45 PM - Deleted user_456 (confirmed)    │
│ • May 10, 11:20 AM - Flagged user_789 (risk: 78)    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## FEATURE 3: PLATFORM METRICS DASHBOARD

### Overview
"We also check the number of users on the platform, Number of registered businesses and partners"

Admin can view real-time platform metrics and analytics.

### Problem Statement
Admin/Management needs visibility into:
1. Total users (by type: trader, seeker, lender)
2. Active users (daily/weekly/monthly)
3. Registered businesses
4. Partner count
5. Transaction volume
6. Revenue metrics

### Use Cases

#### Use Case 3.1: View Overview Dashboard
**Actor**: Admin  
**Trigger**: Admin opens Admin Dashboard (default view)

**Screen Displays**:
```
┌─ ZOVU ADMIN DASHBOARD ────────────────────────────────┐
│                                                       │
│ TODAY'S SNAPSHOT                                      │
│ ────────────────────────────────────────────────────  │
│                                                       │
│ Total Users      │ Active Users    │ New Signups      │
│ ┌──────────────┐ │ ┌──────────────┐│ ┌──────────────┐│
│ │   42,847     │ │ │    8,234     ││ │      342     ││
│ │ ↑ 1.2% vs   │ │ │ ↓ 0.8% vs   ││ │ ↑ 12% vs    ││
│ │  last month  │ │ │  yesterday  ││ │  last month ││
│ └──────────────┘ │ └──────────────┘│ └──────────────┘│
│                                                       │
│ ────────────────────────────────────────────────────  │
│                                                       │
│ USER BREAKDOWN                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Traders:           18,234 (42.6%)  ███████████  │ │
│ │ Job Seekers:       16,890 (39.4%)  ██████████   │ │
│ │ Lenders/Partners:   7,723 (18.0%)  █████        │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
│ ────────────────────────────────────────────────────  │
│                                                       │
│ Registered Businesses:     14,567  (↑ 2.3%)          │
│ Active Partnerships:        1,234  (↑ 0.5%)          │
│ Transaction Volume:    ₦2.4B today  (↑ 15%)          │
│ Avg Transaction Size:  ₦156,000     (↓ 2%)           │
│                                                       │
│ ────────────────────────────────────────────────────  │
│                                                       │
│ ALERTS                                                │
│ ⚠️  5 new fraud flags in last 24 hours               │
│ ⚠️  12 unresolved complaints pending review          │
│ ⚠️  3 partnership requests awaiting approval          │
│                                                       │
└───────────────────────────────────────────────────────┘
```

#### Use Case 3.2: View Growth Metrics
**Actor**: Admin/Analytics  
**Trigger**: Admin opens "Analytics" tab

**Metrics Displayed**:

```json
{
  "users": {
    "total_count": 42847,
    "traders": { "count": 18234, "percentage": 42.6, "new_this_month": 523 },
    "seekers": { "count": 16890, "percentage": 39.4, "new_this_month": 478 },
    "lenders": { "count": 7723, "percentage": 18.0, "new_this_month": 156 },
    "daily_active": 8234,
    "monthly_active": 32567,
    "verified_count": 28394,  // KYC verified
    "unverified_count": 14453
  },
  "businesses": {
    "total_registered": 14567,
    "by_type": {
      "wholesaler": 3456,
      "retailer": 5678,
      "small_kiosk": 3201,
      "online_vendor": 2232
    },
    "new_this_month": 342,
    "average_credit_limit": 250000
  },
  "partnerships": {
    "total_active": 1234,
    "by_type": {
      "lender": 456,
      "insurance": 234,
      "logistics": 345,
      "other": 199
    },
    "pending_requests": 3,
    "approved_this_month": 12
  },
  "transactions": {
    "total_volume_today": 240000000,  // in Kobo (₦2.4B)
    "total_count_today": 1543,
    "average_size": 15600000,  // ₦156,000
    "success_rate": 98.7
  }
}
```

#### Use Case 3.3: View Reports
**Actor**: Admin  
**Trigger**: Admin clicks "Generate Report"

**Available Reports**:
1. **Daily Report**: User metrics, transactions, new signups
2. **Weekly Report**: Growth trends, top performers, issues
3. **Monthly Report**: Comprehensive metrics, partner performance
4. **Custom Report**: Select date range and metrics

**Report Example - Daily Report for May 11, 2026**:
```
═══════════════════════════════════════════════════════════
                    ZOVU DAILY REPORT
                     May 11, 2026
═══════════════════════════════════════════════════════════

📊 USER METRICS
────────────────
Total Users:              42,847 (+145 today)
  • Traders:              18,234 (+65)
  • Job Seekers:          16,890 (+54)
  • Lenders:               7,723 (+26)

Active Today:              8,234
Active This Month:        32,567
Verified (KYC):           28,394 (66.2%)

New Signups:                 145
  • Signup Rate: 0.34% of total users
  • Retention (7-day): 78.4%

💼 BUSINESS METRICS
──────────────────
Registered Businesses:     14,567 (+8 today)
  • Wholesalers:           3,456
  • Retailers:             5,678
  • Small Kiosks:          3,201
  • Online Vendors:        2,232

Average Business Profile:
  • Business Age: 4.2 months
  • Average Credit Limit: ₦250,000
  • Credit Utilized: 34%

🤝 PARTNERSHIP METRICS
────────────────────
Active Partnerships:       1,234 (+1 today)
  • Lenders:                 456
  • Insurance:               234
  • Logistics:               345
  • Others:                  199

Pending Requests:            3
Approved This Month:        12
Rejected This Month:         2

💰 TRANSACTION METRICS
─────────────────────
Total Volume Today:        ₦2.4B (+15% vs avg)
Total Count Today:          1,543
Average Size:              ₦156,000 (-2%)
Success Rate:              98.7% (+0.2%)
Failed Transactions:           20

Top Transaction Types:
  1. Credit Deposits:       ₦1.2B (50%)
  2. Loan Disbursements:    ₦850M (35%)
  3. Ajo Contributions:     ₦250M (10%)
  4. Other:                 ₦100M (5%)

🚨 ALERTS & ISSUES
─────────────────
Fraud Flags:                 5 new
Unresolved Complaints:      12 pending
Paused Accounts:             8
Deleted Accounts Today:      1
Failed Withdrawals:         20

⚠️ Action Items:
   • 3 partnership requests awaiting approval
   • 12 complaints need review
   • 5 users flagged for fraud

═══════════════════════════════════════════════════════════
Report Generated: May 11, 2026 11:30 PM
Generated By: Admin Dashboard System
═══════════════════════════════════════════════════════════
```

---

## FEATURE 4: PARTNERSHIP MANAGEMENT

### Overview
"They send a partnership request. We're the one that's going to post it on the website through admin dashboard"

Admin can review partnership requests and publish them to the platform.

### Problem Statement
Partners (lenders, insurance companies, logistics providers) submit requests to partner with Zovu. Admin must:
1. Review requests
2. Verify company details
3. Approve/reject
4. Publish to website
5. Manage active partnerships

### Use Cases

#### Use Case 4.1: View Partnership Requests
**Actor**: Admin  
**Trigger**: Admin opens "Partnerships" tab → "Pending Requests"

**Flow**:
1. System displays list of pending partnership requests
2. Shows: Company name, type, request date, status
3. Admin can filter by: Status, Type, Date range
4. Admin can sort by: Most recent, Company name

**Data Displayed**:
```json
{
  "pending_requests": [
    {
      "request_id": "uuid",
      "company_name": "Zenith Bank Nigeria",
      "company_type": "lender",
      "submission_date": "2026-05-10T10:30:00Z",
      "status": "pending|under_review|approved|rejected",
      "contact_person": "Mr. Adeyemi Johnson",
      "contact_email": "partnerships@zenithbank.com",
      "contact_phone": "+234 800 XXX XXXX",
      "company_website": "www.zenithbank.com",
      "description": "Zenith Bank wants to offer microloans to Zovu traders.",
      "documents": [
        { "name": "CAC Certificate", "url": "..." },
        { "name": "Business Plan", "url": "..." },
        { "name": "Insurance Certificate", "url": "..." }
      ]
    }
  ],
  "total": 3
}
```

#### Use Case 4.2: Review Partnership Request
**Actor**: Admin  
**Trigger**: Admin clicks on partnership request

**Screen Displays**:
```
┌─ Partnership Request #1234 ────────────────────────────┐
│                                                        │
│ Status: PENDING REVIEW        Submitted: May 10, 2026 │
│                                                        │
├─ COMPANY DETAILS ──────────────────────────────────────┤
│                                                        │
│ Company Name:        Zenith Bank Nigeria              │
│ Partnership Type:    Lender                           │
│ Website:             www.zenithbank.com               │
│ CAC Registration:    RC 1234567 ✓ Verified            │
│                                                        │
│ Contact Person:      Mr. Adeyemi Johnson              │
│ Email:               partnerships@zenithbank.com      │
│ Phone:               +234 800 1234 5678               │
│                                                        │
├─ PARTNERSHIP DETAILS ──────────────────────────────────┤
│                                                        │
│ Partnership Proposal:                                 │
│ "Zenith Bank wants to partner with Zovu to offer     │
│  microloans to our traders. We'll provide:            │
│  - Loans up to ₦500,000                              │
│  - 12-60 month repayment terms                        │
│  - 18% annual interest rate                           │
│  - Quick approval (24 hours)                          │
│                                                        │
│  This will help traders access capital for           │
│  business expansion."                                 │
│                                                        │
├─ DOCUMENTS ────────────────────────────────────────────┤
│                                                        │
│ ✓ CAC Certificate - Verified                          │
│ ✓ Business Plan - 150 pages                           │
│ ✓ Insurance Certificate - Valid until 2027            │
│ ✓ Bank References - 3 clients listed                  │
│                                                        │
├─ ADMIN REVIEW ─────────────────────────────────────────┤
│                                                        │
│ Review Status: [Under Review ▼]                       │
│                                                        │
│ Verification Checklist:                               │
│ ✓ Company registered and verified                     │
│ ✓ Documents authentic                                 │
│ ✓ Financial standing confirmed                        │
│ ⚠ Legal review pending                                │
│ ⚠ Terms negotiation in progress                       │
│                                                        │
│ Admin Notes:                                          │
│ ┌─────────────────────────────────────────────────┐  │
│ │ Initial review looks good. Zenith is a major   │  │
│ │ bank with strong reputation. Their loan terms  │  │
│ │ are competitive. Recommend approval pending    │  │
│ │ legal review.                                  │  │
│ │                                                │  │
│ │ Contact legal team for final clearance.       │  │
│ └─────────────────────────────────────────────────┘  │
│                                                        │
│ [Reject] [Request More Info] [Approve & Publish]     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### Use Case 4.3: Approve Partnership
**Actor**: Admin  
**Trigger**: Admin clicks "Approve & Publish"

**Flow**:
1. Admin clicks "Approve & Publish" button
2. System shows confirmation:
   ```
   Approve Partnership: Zenith Bank Nigeria (Lender)
   
   This will:
   - Mark partnership as APPROVED
   - Publish to Zovu website
   - Send confirmation email to Zenith Bank
   - Enable their integration/products on platform
   
   [Cancel] [Confirm Approval]
   ```
3. Admin confirms
4. System:
   - Updates status to APPROVED
   - Creates Partnership record
   - Sends confirmation email to company
   - Publishes on website/app
   - Enables their integration

**Confirmation Email to Partner**:
```
Subject: Your Zovu Partnership Request Has Been Approved! 🎉

Hello Mr. Adeyemi Johnson,

Great news! Your partnership request with Zovu has been approved.

Zenith Bank Nigeria is now live on the Zovu platform as a lending partner.
Zovu traders can now access Zenith Bank's microloans directly through the app.

Next Steps:
1. We'll contact you within 24 hours to set up your dashboard
2. You can start receiving loan applications immediately
3. Your partnership details are now live on our website: www.zovu.co/partners

If you have any questions, please reach out to partnerships@zovu.co

Welcome to the Zovu family!

Best regards,
Zovu Admin Team
```

#### Use Case 4.4: Reject Partnership
**Actor**: Admin  
**Trigger**: Admin clicks "Reject"

**Flow**:
1. Admin clicks "Reject" button
2. System shows rejection form:
   ```
   Reject Partnership Request
   
   Company: Zenith Bank Nigeria
   
   Reason for Rejection (required):
   [ ] Doesn't meet partner criteria
   [ ] Financial concerns
   [ ] Legal/compliance issues
   [ ] Documents incomplete
   [ ] Other (specify below)
   
   Detailed Explanation (required):
   [Text area for explanation]
   
   [Cancel] [Send Rejection]
   ```
3. Admin provides reason
4. System sends rejection email with explanation

#### Use Case 4.5: View Active Partnerships
**Actor**: Admin  
**Trigger**: Admin opens "Partnerships" tab → "Active Partners"

**Screen Displays**:
```json
{
  "active_partnerships": [
    {
      "partnership_id": "uuid",
      "company_name": "Zenith Bank Nigeria",
      "type": "lender",
      "approved_date": "2026-05-01",
      "status": "active|suspended|archived",
      "customers_served": 1234,
      "transactions_total": ₦2.4B,
      "average_rating": 4.7,
      "contact_email": "partnerships@zenithbank.com",
      "services": [
        "Microloans up to ₦500,000",
        "12-60 month terms",
        "18% APR"
      ]
    }
  ],
  "total_active": 27
}
```

#### Use Case 4.6: Publish Partnership to Website
**Actor**: Admin  
**Trigger**: Auto-triggered when partnership approved, or manually in admin

**Publication Flow**:
1. Partnership approved
2. System checks:
   - Company information complete
   - Logo uploaded
   - Description finalized
   - Terms and conditions agreed
3. If all checks pass: Publish to website automatically
4. Admin can manually update:
   - Featured status
   - Display order
   - Description/marketing copy
   - Logo/branding

**Partner Listing on Website**:
```
PARTNERS & LENDERS
════════════════════════════════════════════════════════

Featured Partners:
┌──────────────────────────────────────────────────────┐
│ [Zenith Bank Logo]                                   │
│                                                      │
│ ZENITH BANK NIGERIA                                  │
│ Trusted Lending Partner                              │
│                                                      │
│ Offering microloans to Zovu traders                 │
│ • Loans: ₦50,000 - ₦500,000                         │
│ • Terms: 12-60 months                               │
│ • Interest: 18% APR                                 │
│ • Approval: 24 hours                                │
│                                                      │
│ Rating: ★★★★★ (4.7/5) from 1,234 borrowers         │
│                                                      │
│ [Learn More] [Apply Now]                            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## DATABASE SCHEMA

### New Tables Required

```sql
-- Complaints table
CREATE TABLE complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complainant_id UUID NOT NULL REFERENCES "user"(id),
    transaction_id UUID NOT NULL REFERENCES transaction(id),
    category VARCHAR(50) NOT NULL,  -- transaction_failed, payment_delayed, etc
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',  -- new, investigating, resolved, escalated
    urgency VARCHAR(20) NOT NULL DEFAULT 'medium',  -- low, medium, high
    admin_notes TEXT,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES "user"(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_complainant(complainant_id),
    INDEX idx_status(status),
    INDEX idx_created(created_at)
);

-- Complaint attachments (screenshots, etc)
CREATE TABLE complaint_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User flags (fraud)
CREATE TABLE user_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES "user"(id),
    flag_reason VARCHAR(50) NOT NULL,  -- fraud, suspicious_activity, etc
    fraud_risk_score INT DEFAULT 0,  -- 0-100
    flag_status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, resolved, dismissed
    flagged_by VARCHAR(50) NOT NULL DEFAULT 'system',  -- 'system' or admin name
    admin_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user(user_id),
    INDEX idx_score(fraud_risk_score),
    INDEX idx_created(created_at)
);

-- Partnership requests
CREATE TABLE partnership_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    company_type VARCHAR(50) NOT NULL,  -- lender, insurance, logistics, etc
    contact_person VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    company_website VARCHAR(500),
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, under_review, approved, rejected
    cac_number VARCHAR(50),
    documents JSONB,  -- Array of {name, url, verified}
    admin_notes TEXT,
    reviewer_id UUID REFERENCES "user"(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status(status),
    INDEX idx_type(company_type),
    INDEX idx_created(created_at)
);

-- Active partnerships
CREATE TABLE partnerships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES partnership_requests(id),
    company_name VARCHAR(255) NOT NULL,
    company_type VARCHAR(50) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, suspended, archived
    logo_url VARCHAR(500),
    description TEXT,
    terms_and_conditions JSONB,
    featured BOOLEAN DEFAULT FALSE,
    display_order INT,
    metrics JSONB,  -- {customers_served, transactions_total, rating}
    api_key VARCHAR(255),  -- For integration
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status(status),
    INDEX idx_type(company_type)
);

-- Admin audit log
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES "user"(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),  -- user, complaint, partnership, etc
    target_id UUID,
    changes JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_admin(admin_id),
    INDEX idx_created(created_at)
);
```

---

## BACKEND IMPLEMENTATION

### New Services Required

#### 1. ComplaintService
```python
# backend/src/services/complaints.py

class ComplaintService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis
    
    async def create_complaint(
        self,
        complainant_id: str,
        transaction_id: str,
        category: str,
        description: str,
    ) -> dict:
        """Create new complaint."""
        
    async def list_complaints(
        self,
        status: str | None = None,
        urgency: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict:
        """List complaints with filtering."""
        
    async def get_complaint_details(self, complaint_id: str) -> dict:
        """Get full complaint details."""
        
    async def verify_transaction(self, complaint_id: str) -> dict:
        """Verify transaction with Squad API."""
        
    async def update_complaint_status(
        self,
        complaint_id: str,
        status: str,
        admin_notes: str,
        admin_id: str,
    ) -> dict:
        """Update complaint status and notes."""
        
    async def upload_attachment(
        self,
        complaint_id: str,
        file_content: bytes,
        file_type: str,
    ) -> str:
        """Upload complaint attachment (screenshot, etc)."""
```

#### 2. FraudService
```python
# backend/src/services/fraud.py (extend existing)

class FraudService:
    async def flag_user(
        self,
        user_id: str,
        reason: str,
        notes: str,
        flagged_by: str,
    ) -> dict:
        """Flag user for fraud review."""
        
    async def get_flagged_users(
        self,
        reason: str | None = None,
        min_score: int | None = None,
        limit: int = 20,
    ) -> dict:
        """Get list of flagged users."""
        
    async def calculate_fraud_score(self, user_id: str) -> int:
        """Calculate fraud risk score (0-100)."""
        
    async def pause_account(
        self,
        user_id: str,
        reason: str,
        admin_id: str,
    ) -> dict:
        """Pause user account (soft freeze)."""
        
    async def unpause_account(
        self,
        user_id: str,
        admin_id: str,
    ) -> dict:
        """Unpause user account."""
        
    async def delete_account(
        self,
        user_id: str,
        reason: str,
        admin_id: str,
    ) -> dict:
        """Permanently delete user account."""
        
    async def get_fraud_analytics(self, days: int = 30) -> dict:
        """Get fraud analytics dashboard data."""
```

#### 3. MetricsService
```python
# backend/src/services/metrics.py

class MetricsService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_overview(self) -> dict:
        """Get dashboard overview metrics."""
        
    async def get_user_metrics(self) -> dict:
        """Get user count by type, active users, etc."""
        
    async def get_business_metrics(self) -> dict:
        """Get registered businesses metrics."""
        
    async def get_partnership_metrics(self) -> dict:
        """Get partnership metrics."""
        
    async def get_transaction_metrics(self) -> dict:
        """Get transaction volume, success rate, etc."""
        
    async def generate_daily_report(self, date: date) -> dict:
        """Generate daily report."""
        
    async def generate_monthly_report(self, year: int, month: int) -> dict:
        """Generate monthly report."""
```

#### 4. PartnershipService
```python
# backend/src/services/partnership.py

class PartnershipService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def submit_request(
        self,
        company_name: str,
        company_type: str,
        contact_person: str,
        contact_email: str,
        description: str,
        documents: list,
    ) -> dict:
        """Submit partnership request."""
        
    async def list_pending_requests(self) -> dict:
        """List pending partnership requests."""
        
    async def get_request_details(self, request_id: str) -> dict:
        """Get partnership request details."""
        
    async def approve_request(
        self,
        request_id: str,
        admin_id: str,
    ) -> dict:
        """Approve partnership request and create active partnership."""
        
    async def reject_request(
        self,
        request_id: str,
        admin_id: str,
        reason: str,
    ) -> dict:
        """Reject partnership request."""
        
    async def list_active_partnerships(self) -> dict:
        """List active partnerships."""
        
    async def publish_partnership(self, partnership_id: str) -> dict:
        """Publish partnership to website."""
        
    async def update_partnership(
        self,
        partnership_id: str,
        updates: dict,
    ) -> dict:
        """Update partnership details."""
```

### New Router Required

```python
# backend/src/routers/admin.py

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.dependencies import get_current_user, require_role
from src.models import User
from src.services.complaints import ComplaintService
from src.services.fraud import FraudService
from src.services.metrics import MetricsService
from src.services.partnership import PartnershipService

router = APIRouter()

# ── COMPLAINTS ──────────────────────────────────────────

@router.get("/complaints", tags=["Admin - Complaints"])
async def list_complaints(
    status: str | None = Query(None),
    urgency: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List complaints (admin only)."""
    await require_role(user, ["admin"])
    service = ComplaintService(db, redis)
    return await service.list_complaints(status, urgency, limit, offset)

@router.get("/complaints/{complaint_id}", tags=["Admin - Complaints"])
async def get_complaint(
    complaint_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get complaint details."""
    await require_role(user, ["admin"])
    service = ComplaintService(db, redis)
    return await service.get_complaint_details(complaint_id)

@router.post("/complaints/{complaint_id}/verify", tags=["Admin - Complaints"])
async def verify_complaint_transaction(
    complaint_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify transaction in complaint."""
    await require_role(user, ["admin"])
    service = ComplaintService(db, redis)
    return await service.verify_transaction(complaint_id)

@router.patch("/complaints/{complaint_id}", tags=["Admin - Complaints"])
async def update_complaint(
    complaint_id: str,
    status: str,
    admin_notes: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update complaint status."""
    await require_role(user, ["admin"])
    service = ComplaintService(db, redis)
    return await service.update_complaint_status(complaint_id, status, admin_notes, user.id)

# ── FRAUD MANAGEMENT ────────────────────────────────────

@router.get("/users/flagged", tags=["Admin - Fraud"])
async def list_flagged_users(
    reason: str | None = Query(None),
    min_score: int | None = Query(None, ge=0, le=100),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List flagged users."""
    await require_role(user, ["admin"])
    service = FraudService(db)
    return await service.get_flagged_users(reason, min_score, limit)

@router.post("/users/{user_id}/flag", tags=["Admin - Fraud"])
async def flag_user(
    user_id: str,
    reason: str,
    notes: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Flag user for fraud investigation."""
    await require_role(user, ["admin"])
    service = FraudService(db)
    return await service.flag_user(user_id, reason, notes, user.email)

@router.post("/users/{user_id}/pause", tags=["Admin - Fraud"])
async def pause_user(
    user_id: str,
    reason: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause user account."""
    await require_role(user, ["admin"])
    service = FraudService(db)
    return await service.pause_account(user_id, reason, user.id)

@router.post("/users/{user_id}/unpause", tags=["Admin - Fraud"])
async def unpause_user(
    user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unpause user account."""
    await require_role(user, ["admin"])
    service = FraudService(db)
    return await service.unpause_account(user_id, user.id)

@router.delete("/users/{user_id}", tags=["Admin - Fraud"])
async def delete_user(
    user_id: str,
    reason: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete user account permanently."""
    await require_role(user, ["admin"])
    service = FraudService(db)
    return await service.delete_account(user_id, reason, user.id)

@router.get("/fraud/analytics", tags=["Admin - Fraud"])
async def get_fraud_analytics(
    days: int = Query(30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get fraud analytics dashboard."""
    await require_role(user, ["admin"])
    service = FraudService(db)
    return await service.get_fraud_analytics(days)

# ── METRICS ─────────────────────────────────────────────

@router.get("/metrics/overview", tags=["Admin - Metrics"])
async def get_metrics_overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard overview metrics."""
    await require_role(user, ["admin", "analytics"])
    service = MetricsService(db)
    return await service.get_overview()

@router.get("/metrics/users", tags=["Admin - Metrics"])
async def get_user_metrics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user metrics."""
    await require_role(user, ["admin", "analytics"])
    service = MetricsService(db)
    return await service.get_user_metrics()

@router.get("/metrics/businesses", tags=["Admin - Metrics"])
async def get_business_metrics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get business metrics."""
    await require_role(user, ["admin", "analytics"])
    service = MetricsService(db)
    return await service.get_business_metrics()

@router.get("/metrics/transactions", tags=["Admin - Metrics"])
async def get_transaction_metrics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get transaction metrics."""
    await require_role(user, ["admin", "analytics"])
    service = MetricsService(db)
    return await service.get_transaction_metrics()

@router.get("/reports/daily", tags=["Admin - Reports"])
async def get_daily_report(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get daily report."""
    await require_role(user, ["admin", "analytics"])
    service = MetricsService(db)
    return await service.generate_daily_report(date)

# ── PARTNERSHIPS ────────────────────────────────────────

@router.get("/partnerships/requests/pending", tags=["Admin - Partnerships"])
async def list_pending_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List pending partnership requests."""
    await require_role(user, ["admin", "partnerships"])
    service = PartnershipService(db)
    return await service.list_pending_requests()

@router.get("/partnerships/requests/{request_id}", tags=["Admin - Partnerships"])
async def get_request_details(
    request_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get partnership request details."""
    await require_role(user, ["admin", "partnerships"])
    service = PartnershipService(db)
    return await service.get_request_details(request_id)

@router.post("/partnerships/requests/{request_id}/approve", tags=["Admin - Partnerships"])
async def approve_partnership(
    request_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approve and publish partnership."""
    await require_role(user, ["admin", "partnerships"])
    service = PartnershipService(db)
    return await service.approve_request(request_id, user.id)

@router.post("/partnerships/requests/{request_id}/reject", tags=["Admin - Partnerships"])
async def reject_partnership(
    request_id: str,
    reason: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject partnership request."""
    await require_role(user, ["admin", "partnerships"])
    service = PartnershipService(db)
    return await service.reject_request(request_id, user.id, reason)

@router.get("/partnerships", tags=["Admin - Partnerships"])
async def list_active_partnerships(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active partnerships."""
    await require_role(user, ["admin", "partnerships"])
    service = PartnershipService(db)
    return await service.list_active_partnerships()
```

---

## FRONTEND IMPLEMENTATION

### New Components Required

```typescript
// frontend/src/features/admin/AdminLayout.tsx
// Main admin dashboard layout with navigation

// frontend/src/features/admin/sections/ComplaintManagement.tsx
// Complaint list, detail view, verification

// frontend/src/features/admin/sections/FraudManagement.tsx
// Flagged users, fraud analytics, actions

// frontend/src/features/admin/sections/MetricsDashboard.tsx
// KPI overview, charts, reports

// frontend/src/features/admin/sections/PartnershipManagement.tsx
// Partnership requests, approval flow

// frontend/src/services/adminService.ts
// API calls to admin endpoints
```

---

## API ENDPOINTS

### Complaints API

```
GET    /api/v1/admin/complaints
POST   /api/v1/admin/complaints
GET    /api/v1/admin/complaints/{id}
PATCH  /api/v1/admin/complaints/{id}
POST   /api/v1/admin/complaints/{id}/verify
POST   /api/v1/admin/complaints/{id}/attachments
```

### Fraud API

```
GET    /api/v1/admin/users/flagged
POST   /api/v1/admin/users/{id}/flag
POST   /api/v1/admin/users/{id}/pause
POST   /api/v1/admin/users/{id}/unpause
DELETE /api/v1/admin/users/{id}
GET    /api/v1/admin/fraud/analytics
```

### Metrics API

```
GET    /api/v1/admin/metrics/overview
GET    /api/v1/admin/metrics/users
GET    /api/v1/admin/metrics/businesses
GET    /api/v1/admin/metrics/partnerships
GET    /api/v1/admin/metrics/transactions
GET    /api/v1/admin/reports/daily
GET    /api/v1/admin/reports/monthly
```

### Partnership API

```
GET    /api/v1/admin/partnerships/requests/pending
GET    /api/v1/admin/partnerships/requests/{id}
POST   /api/v1/admin/partnerships/requests/{id}/approve
POST   /api/v1/admin/partnerships/requests/{id}/reject
GET    /api/v1/admin/partnerships
PUT    /api/v1/admin/partnerships/{id}
```

---

## INTEGRATION FLOW

### Complaint Investigation Flow

```
1. User files complaint
   ↓
2. Admin views in Complaint List
   ↓
3. Admin opens complaint details
   ↓
4. Admin clicks "Verify with Squad"
   ↓
5. System queries Squad API
   ↓
6. Squad returns transaction status
   ↓
7. Admin compares with complaint
   ↓
8. Admin writes investigation notes
   ↓
9. Admin selects resolution:
   - RESOLVED (user error)
   - REFUND (real issue)
   - ESCALATE (needs support)
   - FRAUD (suspicious)
   ↓
10. System sends resolution email to user
    ↓
11. Complaint marked as resolved
```

### Fraud Detection Flow

```
1. System detects suspicious activity:
   - Multiple complaints
   - Chargebacks
   - Failed transactions
   - Device anomalies
   ↓
2. System automatically flags user
   ↓
3. Admin sees flag in Fraud Management
   ↓
4. Admin reviews user's history
   ↓
5. Admin decides:
   - Dismiss (false alarm)
   - Pause account (investigate)
   - Delete (confirmed fraud)
   ↓
6. System executes action
   ↓
7. User is notified (if applicable)
   ↓
8. Audit log created
```

### Partnership Approval Flow

```
1. Partner submits request
   ↓
2. Request appears in Admin Dashboard
   ↓
3. Admin reviews documents
   ↓
4. Admin verifies company details
   ↓
5. Admin may request more info or approve
   ↓
6. If approved:
   - Partnership created
   - Published to website
   - Confirmation email sent
   ↓
7. Partner can start offering services
```

---

## SECURITY CONSIDERATIONS

### Access Control
```python
# Only admin users can access admin endpoints
require_role(user, ["admin"])

# Different roles for different features:
- "admin": Full access
- "compliance": Complaints + fraud
- "analytics": Metrics + reports
- "partnerships": Partnership management
```

### Data Protection
```
- PII encrypted in database
- Audit log for all admin actions
- Admin IP addresses logged
- All actions require authentication
- Rate limiting on sensitive endpoints
```

### Compliance
```
- GDPR: User data deletion logged
- Data retention: Complaints kept for 2 years
- Admin actions: Full audit trail
- Fund access: Only through verified Squad API
```

---

## IMPLEMENTATION ROADMAP

### Phase 1: Complaint Management (Week 1)
```
Day 1-2: Create ComplaintService + Router
Day 3: Frontend complaint list view
Day 4: Frontend complaint detail view
Day 5: Integrate Squad verification
Day 6-7: Testing + bug fixes
```

### Phase 2: Fraud Management (Week 2)
```
Day 1-2: Create FraudService + Router
Day 3: Fraud flag and pause logic
Day 4: Frontend fraud management UI
Day 5: Fraud analytics dashboard
Day 6-7: Testing + bug fixes
```

### Phase 3: Metrics Dashboard (Week 3)
```
Day 1-2: Create MetricsService + queries
Day 3-4: Build metrics dashboard UI
Day 5: Generate reports
Day 6-7: Testing + bug fixes
```

### Phase 4: Partnership Management (Week 4)
```
Day 1-2: Create PartnershipService + Router
Day 3: Build partnership request UI
Day 4: Approval/rejection flow
Day 5: Website publishing
Day 6-7: Testing + bug fixes
```

---

## SUMMARY

The Admin Dashboard is a comprehensive operations and compliance tool that enables:

✅ **Complaint Management** - Investigate transactions and resolve user disputes  
✅ **Fraud Detection** - Flag suspicious users and take action  
✅ **Platform Metrics** - Track KPIs and user growth  
✅ **Partnership Management** - Approve and publish partner integrations  

**Estimated Total Effort**: 15-20 hours full stack implementation  
**Priority**: 🔴 HIGH - Core operations feature

This feature is essential for production launch to handle real-world issues and maintain platform health.

