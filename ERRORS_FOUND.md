# 🐛 Code Errors & Inconsistencies Report

## Critical Issues Found

---

## 1. **SCHEMA MISMATCH: personalInfoSchema**

**File:** `frontend/src/features/Auth/schemas/personalInfo.schema.ts`

### Problem:
The schema is INCOMPLETE. It only validates 4 fields, but the components try to use many more.

### Current Schema Validates:
```typescript
{
  role: enum['Trader', 'Job Seeker', 'Both', 'Lender'],
  email: string (valid email),
  password: string (8+ chars, 1 upper, 1 lower, 1 num, 1 special),
  businessName: string (optional, required if role is Trader/Both/Lender),
}
```

### Missing Validations:
- ❌ `firstName` (rendered in PersonalInfo, not validated)
- ❌ `lastName` (rendered in PersonalInfo, not validated)
- ❌ `middleName` (rendered in PersonalInfo, not validated)
- ❌ `phoneNumber` (rendered in PersonalInfo, not validated)
- ❌ `dateOfBirth` (rendered in PersonalInfo, not validated)
- ❌ `gender` (rendered in PersonalInfo, not validated)
- ❌ `confirmPassword` (rendered in PersonalInfo, not validated)

### Impact:
- Form validation will pass even if user leaves firstname/lastname/phone empty
- No check that password matches confirmPassword
- Date of birth age validation missing (18–100 year old check)
- Phone number format validation missing

---

## 2. **NO PASSWORD CONFIRMATION VALIDATION**

**Files:**
- `frontend/src/features/Auth/schemas/personalInfo.schema.ts`
- `frontend/src/features/Auth/screens/PersonalInfo.tsx` (renders field but no validation)
- `frontend/src/features/Auth/screens/Signup.tsx`

### Problem:
User can enter two different passwords and form still submits.

### Example:
```
Password:         "MySecret@123"
Confirm Password: "MySecret@456"
→ Form submits successfully ❌
```

### Fix Needed:
Add `.refine()` to schema to validate password === confirmPassword

---

## 3. **TWO DIFFERENT SIGNUP FLOWS (DUPLICATE/CONFLICTING)**

**Files:**
- `frontend/src/features/Auth/screens/PersonalInfo.tsx`
- `frontend/src/features/Auth/screens/Signup.tsx`

### Problem:
There are TWO signup screens that look similar:

| Aspect | PersonalInfo | Signup |
|--------|-------------|--------|
| **Route Used** | ❌ NOT USED IN ROUTES | ✅ `/signup` |
| **Fields Rendered** | firstName, lastName, middleName, email, phoneNumber, password, confirmPassword, dob, gender | email, password, businessName, role (only) |
| **Schema Used** | personalInfoSchema | personalInfoSchema |
| **Data Flow** | Saves to sessionStorage, moves to RoleInfo → IdentityVerification → FinancialProfile | Saves to sessionStorage, moves directly to dashboard |

### Issue:
- PersonalInfo is fully built but **never used in routing**
- Signup is minimal but **is the actual signup route**
- Both use same broken `personalInfoSchema`
- Different intended flows cause confusion

### Question:
**Which flow is correct?**
1. Simple: Email → Password → Role → Business Name → Dashboard?
2. Complex: Full form (first name, dob, gender, phone) → Role → Identity → Financial Profile?

---

## 4. **MISSING PHONE NUMBER VALIDATION**

**File:** `frontend/src/features/Auth/schemas/personalInfo.schema.ts`

### Problem:
No validation for phone number format.

### Current:
```typescript
export const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/\s+/g, '');
  if (cleaned.startsWith('+234')) return cleaned;
  if (cleaned.startsWith('234')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+234${cleaned.slice(1)}`;
  return cleaned;
};
// ^ This exists in authService.ts but NOT in schema validation!
```

### Issue:
- User can submit "+123456789" (not Nigerian)
- User can submit "abcdefghij" (invalid)
- Schema doesn't validate phone format AT ALL

### Fix Needed:
Add phone validation to schema (must be 10–11 digits, start with 0, 234, or +234)

---

## 5. **MISSING DATE OF BIRTH VALIDATION**

**File:** `frontend/src/features/Auth/schemas/personalInfo.schema.ts`

### Problem:
No validation for DOB in schema.

### Current (HTML only):
```typescript
<TextInput
  id="dateOfBirth"
  type="date"
  max={maxDob}  // ← Only in HTML, not schema
  min={minDob}  // ← Only in HTML, not schema
  {...register('dateOfBirth')}
/>
```

### Issue:
- User can bypass HTML constraints by editing localStorage
- Server receives any date (future dates, invalid ages)
- If backend doesn't validate, data integrity broken

### Fix Needed:
Add date validation to schema:
- Must be 18–100 years old (calculated from today)
- Must be in past
- Must be valid date

---

## 6. **GENDER_OPTIONS NOT IN SCHEMA**

**File:** `frontend/src/features/Auth/schemas/personalInfo.schema.ts`

### Problem:
```typescript
gender: '',  // ← No validation at all
```

vs 

```typescript
GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
]
```

### Issue:
- No enum validation
- User can submit "InvalidGender" and form passes
- No check that gender is one of the allowed values

### Fix Needed:
```typescript
gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say'], {
  message: 'Please select a valid gender',
})
```

---

## 7. **MISSING REQUIRED FIELD MESSAGES**

**File:** `frontend/src/features/Auth/schemas/personalInfo.schema.ts`

### Problem:
Most fields are optional or missing `.min(1, '...')` checks.

### Current:
```typescript
firstName: z.string()  // ← No min length check!
lastName: z.string()   // ← No validation!
middleName: z.string() // ← Optional but no validation!
phoneNumber: z.string() // ← No format validation!
dateOfBirth: z.string() // ← No date validation!
```

### Issue:
- User can submit empty strings: `{ firstName: '' }`
- Validation error messages are generic/missing
- User has no guidance on what's wrong

---

## 8. **INCONSISTENT PASSWORD REQUIREMENTS**

**Files:**
- Backend LLD says: "8+ chars, 1 upper, 1 lower, 1 number, 1 special"
- Frontend schema validates same
- **BUT:** No visual feedback showing which requirements are met/unmet

### Issue:
- User doesn't know why password is rejected until they submit
- No live validation feedback (checkmarks as they type)
- UX is confusing

---

## 9. **NO CONFIRMATION THAT PASSWORDS MATCH**

**File:** `frontend/src/features/Auth/screens/PersonalInfo.tsx`

### Problem:
```typescript
<PasswordInput
  id="password"
  {...register('password')}
/>

<PasswordInput
  id="confirmPassword"  // ← Rendered but not validated against password
  {...register('confirmPassword')}
/>
```

### Issue:
- UI renders two fields
- No indication to user that they must match
- No validation error if they don't match
- Form can submit with mismatched passwords

---

## 10. **MISSING ROLE SELECTION IN PERSONALINFO**

**File:** `frontend/src/features/Auth/screens/PersonalInfo.tsx`

### Problem:
`personalInfoSchema` requires `role: enum['Trader', 'Job Seeker', 'Both', 'Lender']`

**BUT:** PersonalInfo screen has **NO role selection field**.

### Issue:
- Schema validation will fail with "role is required"
- User sees error but no way to fix it
- Role should be selected before PersonalInfo or in the form

---

## Summary Table

| Error | Severity | Impact | Location |
|-------|----------|--------|----------|
| No password match validation | 🔴 CRITICAL | User can set password ≠ confirmPassword | personalInfoSchema |
| Missing firstName/lastName/phone validation | 🔴 CRITICAL | Empty names/phones accepted | personalInfoSchema |
| No date of birth validation | 🔴 CRITICAL | Invalid ages accepted | personalInfoSchema |
| No gender enum validation | 🟡 HIGH | Any gender value accepted | personalInfoSchema |
| Two signup flows (PersonalInfo unused) | 🟡 HIGH | Confusion, dead code | routes |
| No role selection in PersonalInfo | 🟡 HIGH | Form fails despite user input | PersonalInfo.tsx |
| Phone format not validated | 🟡 HIGH | International numbers accepted | personalInfoSchema |
| No password confirmation UI feedback | 🟠 MEDIUM | UX confusion | PersonalInfo.tsx |
| Missing required field messages | 🟠 MEDIUM | Poor error guidance | personalInfoSchema |

---

## Recommended Fixes (Priority Order)

### 1. Fix personalInfoSchema (URGENT)
```typescript
export const personalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  email: z.string().min(1, 'Email is required').email('Invalid email'),
  phoneNumber: z.string()
    .regex(/^(\+234|0|234)\d{9,10}$/, 'Invalid Nigerian phone number'),
  dateOfBirth: z.string()
    .refine(
      (dob) => {
        const age = new Date().getFullYear() - new Date(dob).getFullYear();
        return age >= 18 && age <= 100;
      },
      'You must be between 18 and 100 years old'
    ),
  gender: z.enum(['Male', 'Female', 'Other', 'Prefer not to say'], {
    message: 'Please select a valid gender',
  }),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/\d/, 'Must contain a number')
    .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
  businessName: z.string().optional(),
  role: z.enum(['Trader', 'Job Seeker', 'Both', 'Lender']),
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
).refine(
  (data) => {
    if (['Trader', 'Both', 'Lender'].includes(data.role) && !data.businessName?.trim()) {
      return false;
    }
    return true;
  },
  {
    message: 'Business name is required for your selected role',
    path: ['businessName'],
  }
);
```

### 2. Decide: Keep PersonalInfo or Signup?
- If keeping PersonalInfo: Update routes to use it
- If keeping Signup: Delete PersonalInfo (dead code)
- **Recommendation:** Delete PersonalInfo if only email/password/role/businessName are needed

### 3. Add role selection to form
- Either add role selector to PersonalInfo/Signup
- Or move it to RoleInfo screen (second step)

### 4. Add password confirmation visual feedback
- Show checkmarks/X as user types
- Highlight "passwords don't match" error
- Disable submit button if passwords don't match

---

## Backend Mismatch

**Backend expects (from `/auth/kyc`):**
```python
{
  first_name: string,
  last_name: string,
  date_of_birth: string (ISO),
  phone: string (normalized),
  bvn?: string,
  nin?: string,
}
```

**Frontend sends (from Signup.tsx):**
```typescript
{
  email: string,
  password: string,
  businessName?: string,
  role: enum,
}
```

### Issue:
- Frontend Signup doesn't collect KYC data!
- Either:
  1. Extend Signup to collect all fields, OR
  2. Keep multi-step (PersonalInfo → RoleInfo → Identity → Financial)

**Recommendation:** Use multi-step flow since identity + financial info needed anyway
