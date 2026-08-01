# Mock Code Inventory - Frontend UI

**Date**: January 2025  
**Purpose**: Complete inventory of all mock/test code in the frontend applications

---

## 📋 Summary

This document lists all mock code, test data, and placeholder implementations found in the frontend UI codebase. These should be replaced with real API calls and proper authentication.

**Total Files with Mock Code**: 20+ files  
**Categories**: Authentication, Mock Data Fallbacks, Test Mode Flags, Hardcoded Values

---

## 🔴 Employee Portal - Mock Code

### 1. **Authentication Context** (`src/contexts/AuthContext.tsx`)
**Lines**: 21-33, 66

**Mock Code**:
```typescript
// Test mode detection using localStorage
const employeeId = localStorage.getItem('employee_id');

// Test mode - create mock user immediately
if (employeeId) {
  setUser({
    id: employeeId,
    email: 'test@example.com',
    name: 'Test User',
  } as User);
  setLoading(false);
}

// Cleanup on logout
localStorage.removeItem('employee_id');
```

**Issue**: Creates mock user when `employee_id` exists in localStorage instead of using real authentication.

---

### 2. **API Service** (`src/services/api.ts`)
**Lines**: 31-33

**Mock Code**:
```typescript
// Only redirect in production, not in test mode
const isTestMode = localStorage.getItem('employee_id') || localStorage.getItem('user_id');
if (!isTestMode) {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token');
  window.location.href = '/login';
}
```

**Issue**: Bypasses authentication redirect when test mode flags exist.

---

### 3. **My Benefits** (`src/pages/MyBenefits.tsx`)
**Lines**: 74-115

**Mock Data**:
```typescript
// Mock data for demo
setEnrollments([
  {
    id: '1',
    plan_id: 'plan1',
    plan_name: 'Discovery Health Medical Aid',
    benefit_type: 'medical_aid',
    provider_name: 'Discovery Health',
    status: 'active',
    effective_date: '2025-01-01',
    employee_contribution: 2500,
    employer_contribution: 3000,
    total_contribution: 5500,
    member_number: 'DH123456789',
    dependent_count: 2,
  },
  // ... more mock enrollments
]);
```

**Issue**: Falls back to mock data when API fails. Should show error instead.

---

### 4. **Benefit Enrollment** (`src/pages/BenefitEnroll.tsx`)
**Lines**: 78-136

**Mock Data**:
```typescript
// Mock data for demo
setPlans([
  {
    id: '1',
    name: 'Discovery Health Medical Aid',
    benefit_type: 'medical_aid',
    provider_name: 'Discovery Health',
    description: 'Comprehensive medical aid coverage for you and your family',
    is_statutory: false,
    allows_dependents: true,
    tax_treatment: 'fringe_benefit',
    options: [/* mock options */],
    rates: [/* mock rates */],
  },
  // ... more mock plans
]);
```

**Issue**: Falls back to mock data when API fails.

---

### 5. **My Expenses** (`src/pages/MyExpenses.tsx`)
**Lines**: 48-73

**Mock Data**:
```typescript
// Mock data for demo
setClaims([
  {
    id: '1',
    claim_number: 'EXP202501001',
    claim_date: '2025-12-20',
    period_start: '2025-12-01',
    period_end: '2025-12-15',
    status: 'pending_approval',
    total_amount: 3500,
    currency: 'ZAR',
    created_at: '2025-12-20T10:30:00Z',
  },
  // ... more mock claims
]);
```

**Issue**: Falls back to mock data when API fails.

---

### 6. **Create Expense Claim** (`src/pages/CreateExpenseClaim.tsx`)
**Lines**: 74-84, 154

**Mock Code**:
```typescript
// Mock data
setCategories([
  { id: 'cat-travel', name: 'Travel', icon: 'plane', requires_receipt: true },
  { id: 'cat-accommodation', name: 'Accommodation', icon: 'bed', requires_receipt: true },
  // ... more mock categories
]);

// Uses localStorage for employee ID
const employeeId = localStorage.getItem('employee_id') || 'current';
```

**Issue**: Mock categories fallback and uses localStorage for employee ID.

---

### 7. **Team Directory** (`src/pages/TeamDirectory.tsx`)
**Lines**: 32-39

**Mock Data**:
```typescript
setTeam([
  { id: '1', employee_number: 'EMP001', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.johnson@company.com', phone: '+27 11 123 4567', job_title: 'Chief Executive Officer', department: 'Executive' },
  { id: '2', employee_number: 'EMP002', first_name: 'Michael', last_name: 'Chen', email: 'michael.chen@company.com', phone: '+27 11 123 4568', job_title: 'Chief Financial Officer', department: 'Finance' },
  // ... more mock team members
]);
```

**Issue**: Falls back to mock team data when API fails.

---

### 8. **Documents** (`src/pages/Documents.tsx`)
**Lines**: 41-45

**Mock Data**:
```typescript
setDocuments([
  { id: '1', name: 'National_ID_Copy.pdf', type: 'application/pdf', category: 'identification', size: 245000, uploaded_at: new Date(Date.now() - 2592000000).toISOString(), uploaded_by: 'John Doe' },
  { id: '2', name: 'Degree_Certificate.pdf', type: 'application/pdf', category: 'certificates', size: 512000, uploaded_at: new Date(Date.now() - 5184000000).toISOString(), uploaded_by: 'John Doe' },
  // ... more mock documents
]);
```

**Issue**: Falls back to mock documents when API fails.

---

### 9. **My Goals** (`src/pages/MyGoals.tsx`)
**Lines**: 30, 48

**Mock Code**:
```typescript
const [employeeId] = useState(localStorage.getItem('employee_id') || '');

// In test mode or when API fails, use empty array so page still renders
```

**Issue**: Uses localStorage for employee ID and silently fails to empty array.

---

### 10. **Apply for Loan** (`src/pages/ApplyForLoan.tsx`)
**Lines**: 51

**Mock Code**:
```typescript
const [employeeId] = useState(localStorage.getItem('employee_id') || '');
```

**Issue**: Uses localStorage for employee ID instead of auth context.

---

### 11. **My Loans** (`src/pages/MyLoans.tsx`)
**Lines**: 66

**Mock Code**:
```typescript
const [employeeId] = useState(localStorage.getItem('employee_id') || '');
```

**Issue**: Uses localStorage for employee ID instead of auth context.

---

### 12. **Time Tracking** (`src/pages/TimeTracking.tsx`)
**Lines**: 68

**Mock Code**:
```typescript
const employeeId = localStorage.getItem('employee_id');
```

**Issue**: Uses localStorage for employee ID instead of auth context.

---

## 🔴 Admin Portal - Mock Code

### 1. **Benefit Plans** (`src/pages/BenefitPlans.tsx`)
**Lines**: 80-128

**Mock Data**:
```typescript
// Mock data for demo
const mockPlans: BenefitPlan[] = [
  {
    id: '1',
    name: 'Unemployment Insurance Fund (UIF)',
    benefit_type: 'uif',
    provider_name: 'Department of Employment and Labour',
    is_statutory: true,
    is_active: true,
    allows_dependents: false,
    tax_treatment: 'tax_deductible',
    effective_date: '2024-01-01',
  },
  // ... more mock plans
];

setPlans(mockPlans);
setStatistics({
  total_plans: 12,
  active_plans: 10,
  statutory_plans: 2,
  total_enrollments: 485,
});
```

**Issue**: Falls back to mock data when API fails.

---

### 2. **Benefit Enrollments** (`src/pages/BenefitEnrollments.tsx`)
**Lines**: 92-156

**Mock Data**:
```typescript
// Mock data for demo
const mockEnrollments: EmployeeBenefit[] = [
  {
    id: '1',
    employee_id: 'emp1',
    first_name: 'John',
    last_name: 'Doe',
    employee_number: 'EMP001',
    plan_id: 'plan1',
    plan_name: 'Discovery Health Medical Aid',
    provider_name: 'Discovery Health',
    enrollment_date: '2025-12-20',
    effective_date: '2026-01-01',
    status: 'pending_approval',
    employee_contribution: 2500,
    employer_contribution: 3000,
    total_contribution: 5500,
    // ... more fields
  },
  // ... more mock enrollments
];

setEnrollments(mockEnrollments);
```

**Issue**: Falls back to mock data when API fails.

---

### 3. **Benefit Reports** (`src/pages/BenefitReports.tsx`)
**Lines**: 59-125

**Mock Data**:
```typescript
// Mock data for demo
setDeductionSummary({
  total_deductions: 245000,
  total_employer_contributions: 325000,
  total_amount: 570000,
  by_plan: [
    {
      plan_id: '1',
      plan_name: 'Discovery Health Medical Aid',
      employee_count: 45,
      total_employee: 112500,
      total_employer: 135000,
      total: 247500,
    },
    // ... more mock plan data
  ],
});

setEnrollmentStats({
  total: 485,
  by_status: { active: 425, pending_approval: 12, /* ... */ },
  by_plan: { 'Discovery Health Medical Aid': 85, /* ... */ },
});
```

**Issue**: Falls back to mock data when API fails.

---

### 4. **Expense Claims** (`src/pages/ExpenseClaims.tsx`)
**Lines**: 76

**Mock Code**:
```typescript
// Mock data for demo
```

**Issue**: Contains mock data fallback (needs full file review).

---

### 5. **Expense Reports** (`src/pages/ExpenseReports.tsx`)
**Lines**: 85-193

**Mock Data**:
```typescript
// Mock data for reports (in production, these would be separate API endpoints)
setCategorySpending([
  { category_name: 'Travel', total_amount: 125000, claim_count: 45, percentage: 35 },
  { category_name: 'Meals', total_amount: 89000, claim_count: 120, percentage: 25 },
  // ... more mock spending data
]);

setMonthlyTrends([
  {
    month: 'Jul 2024',
    total_amount: 55000,
    claim_count: 23,
    approved_count: 21,
    rejected_count: 2,
  },
  // ... more mock monthly data
]);

// Mock statistics
setTopSpenders([/* mock data */]);
```

**Issue**: Uses mock data for reports and statistics.

---

### 6. **Expense Policies** (`src/pages/ExpensePolicies.tsx`)
**Lines**: 109-146

**Mock Data**:
```typescript
// Mock data for demo
setCategories([
  {
    id: 'cat-travel',
    code: 'TRAVEL',
    name: 'Travel',
    description: 'Air, rail, and other transport',
    requires_receipt: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  // ... more mock categories
]);

setPolicies([
  {
    id: 'policy-1',
    category_id: 'cat-meals',
    category_name: 'Meals',
    policy_type: 'per_diem',
    country: 'ZAF',
    currency: 'ZAR',
    amount: 550,
    unit: 'day',
    description: 'Full day meals allowance (SA)',
    effective_from: '2024-01-01',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
]);
```

**Issue**: Falls back to mock data when API fails.

---

### 7. **Payroll Reports** (`src/pages/PayrollReports.tsx`)
**Lines**: 72-78

**Mock Data**:
```typescript
// Mock data
if (reportType === 'tax_summary') setReportData([
  { tax_type: 'PAYE', tax_name: 'Pay As You Earn', payrun_count: 12, total_employee_tax: 2450000, total_employer_tax: 0, total_tax: 2450000 },
  { tax_type: 'UIF', tax_name: 'Unemployment Insurance', payrun_count: 12, total_employee_tax: 125000, total_employer_tax: 125000, total_tax: 250000 },
  { tax_type: 'SDL', tax_name: 'Skills Development', payrun_count: 12, total_employee_tax: 0, total_employer_tax: 185000, total_tax: 185000 },
]);
else if (reportType === 'turnover') setReportData({ terminated_count: 15, hired_count: 22, current_active: 450, avg_tenure_months: 28.5, turnover_rate: 3.3, period_months: 12 });
```

**Issue**: Falls back to mock data when API fails.

---

### 8. **Payment Batch Detail** (`src/pages/PaymentBatchDetail.tsx`)
**Lines**: 60-67

**Mock Data**:
```typescript
// Mock data
setBatch({
  id: id || '1',
  batch_number: 'PB202512001',
  total_amount: 2850000,
  total_transactions: 3,
  status: 'pending_approval',
  created_by_name: 'John Doe',
  bank_file_format: 'eft',
  payment_date: '2025-12-25',
  created_at: '2025-12-20T10:30:00Z',
  items: [
    { id: '1', employee_number: 'EMP001', employee_name: 'Sarah Johnson', bank_name: 'Standard Bank', branch_code: '051001', account_number: '****4521', account_type: 'Cheque', amount: 45000, reference: 'SAL-DEC-001' },
    // ... more mock items
  ],
});
```

**Issue**: Falls back to mock data when API fails.

---

## 🔍 Common Patterns

### Pattern 1: localStorage for Employee ID
**Found in**: Multiple files
```typescript
const employeeId = localStorage.getItem('employee_id') || 'current';
```

**Issue**: Should use authenticated user from context instead.

---

### Pattern 2: Test Mode Detection
**Found in**: `AuthContext.tsx`, `api.ts`
```typescript
const isTestMode = localStorage.getItem('employee_id') || localStorage.getItem('user_id');
```

**Issue**: Bypasses authentication checks.

---

### Pattern 3: Mock Data Fallback
**Found in**: Most data-fetching components
```typescript
try {
  const response = await api.get('/endpoint');
  setData(response.data);
} catch (error) {
  // Mock data for demo
  setData([/* hardcoded mock data */]);
}
```

**Issue**: Should show error message instead of silently using mock data.

---

## ✅ Recommendations

### High Priority
1. **Remove test mode flags** - Remove all `employee_id` and `user_id` localStorage checks
2. **Use AuthContext** - Replace all `localStorage.getItem('employee_id')` with authenticated user from context
3. **Remove mock data fallbacks** - Replace with proper error handling and user feedback
4. **Fix authentication flow** - Remove mock user creation in AuthContext

### Medium Priority
5. **Add error boundaries** - Show proper error messages when API calls fail
6. **Add loading states** - Better UX during data fetching
7. **Add retry logic** - For failed API calls

### Low Priority
8. **Add unit tests** - Test components without mock data
9. **Add integration tests** - Test with real API endpoints
10. **Document API contracts** - Clear documentation of expected responses

---

## 📝 Files to Update

### Employee Portal
- [ ] `src/contexts/AuthContext.tsx` - Remove test mode
- [ ] `src/services/api.ts` - Remove test mode bypass
- [ ] `src/pages/MyBenefits.tsx` - Remove mock data
- [ ] `src/pages/BenefitEnroll.tsx` - Remove mock data
- [ ] `src/pages/MyExpenses.tsx` - Remove mock data
- [ ] `src/pages/CreateExpenseClaim.tsx` - Remove mock data, use auth context
- [ ] `src/pages/TeamDirectory.tsx` - Remove mock data
- [ ] `src/pages/Documents.tsx` - Remove mock data
- [ ] `src/pages/MyGoals.tsx` - Use auth context
- [ ] `src/pages/ApplyForLoan.tsx` - Use auth context
- [ ] `src/pages/MyLoans.tsx` - Use auth context
- [ ] `src/pages/TimeTracking.tsx` - Use auth context

### Admin Portal
- [ ] `src/pages/BenefitPlans.tsx` - Remove mock data
- [ ] `src/pages/BenefitEnrollments.tsx` - Remove mock data
- [ ] `src/pages/BenefitReports.tsx` - Remove mock data
- [ ] `src/pages/ExpenseClaims.tsx` - Remove mock data
- [ ] `src/pages/ExpenseReports.tsx` - Remove mock data
- [ ] `src/pages/ExpensePolicies.tsx` - Remove mock data
- [ ] `src/pages/PayrollReports.tsx` - Remove mock data
- [ ] `src/pages/PaymentBatchDetail.tsx` - Remove mock data

---

## 🎯 Next Steps

1. **Create migration plan** - Step-by-step plan to remove all mock code
2. **Update AuthContext** - Remove test mode, use real JWT tokens
3. **Update API service** - Remove test mode bypasses
4. **Add error handling** - Replace mock fallbacks with error messages
5. **Update all pages** - Use authenticated user from context
6. **Test thoroughly** - Ensure all features work with real API

---

**Last Updated**: January 2025
