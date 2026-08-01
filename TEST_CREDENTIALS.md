# Test Credentials and Roles

## ⚠️ Important: Login Endpoint Not Yet Implemented

**Current Status**: The backend does not have a `/auth/login` endpoint implemented yet. The frontend expects this endpoint, but it's missing from the backend.

**Workaround for Testing**:
- For E2E tests (Playwright), mock tokens are used via localStorage
- For API testing, you'll need to generate JWT tokens manually or implement the login endpoint

## Default Test User (Created by Seed)

### Admin User
- **Email**: `admin@demo.workforce`
- **Password Hash**: `$2b$10$demo_hash_not_for_production` (placeholder - not a real hash)
- **Role**: `ADMIN`
- **Name**: Demo Admin
- **Access**: Full system access to all legal entities

**Note**: The password hash in the seed file is a placeholder. You'll need to:
1. Implement a login endpoint that validates passwords
2. Update the seed file with a proper bcrypt hash
3. Or generate JWT tokens manually for testing

## Available Roles

The system has the following roles defined in the database:

### 1. ADMIN
- **Description**: Full system access
- **Permissions**: All permissions (payrun:read, payrun:write, payrun:approve, employee:read, employee:write, config:write)
- **Use case**: System administrators
- **Created in seed**: ✅ Yes

### 2. PAYROLL_MANAGER
- **Description**: Manage payroll operations
- **Permissions**: Can manage payroll, approve payruns
- **Use case**: Payroll department managers
- **Created in seed**: ✅ Yes

### 3. PAYROLL_CLERK
- **Description**: Process payroll data
- **Permissions**: Can create/edit payruns, view employees
- **Use case**: Payroll processing staff
- **Created in seed**: ✅ Yes

### 4. APPROVER
- **Description**: Approve payruns and changes
- **Permissions**: Can approve payruns and change requests
- **Use case**: Managers who approve payroll
- **Created in seed**: ✅ Yes

### 5. AUDITOR
- **Description**: Read-only audit access
- **Permissions**: Read-only access to all data
- **Use case**: Auditors and compliance officers
- **Created in seed**: ✅ Yes

### 6. HR_ADMIN
- **Description**: Human resources administration
- **Permissions**: Employee management, HR functions
- **Use case**: HR department staff
- **Created in seed**: ❌ No (defined in schema but not seeded)

## Permissions Created by Seed

The seed script creates these permissions:
- `payrun:read` - View payruns
- `payrun:write` - Create/edit payruns
- `payrun:approve` - Approve payruns
- `employee:read` - View employees
- `employee:write` - Create/edit employees
- `config:write` - Manage system config

## Sample Employees Created by Seed

The seed script creates 10 sample employees for testing:

| Employee # | Name | Job Title | Salary | Scenario |
|------------|------|-----------|--------|----------|
| EMP001 | John Smith | Software Developer | R45k/month | Standard salaried employee |
| EMP002 | Sarah Johnson | Senior Manager | R95k/month | High earner (top tax bracket) |
| EMP003 | Michael Williams | Technician | R25k/month | With regular overtime |
| EMP004 | Emily Brown | Sales Representative | R20k/month | Commission-based (variable pay) |
| EMP005 | David Davis | Financial Controller | R75k/month | With pension contributions |
| EMP006 | Lisa Miller | Graduate Trainee | R15k/month | New starter (below tax threshold) |
| EMP007 | James Wilson | Executive Director | R180k/month | Executive (highest bracket) |
| EMP008 | Amanda Taylor | HR Manager | R55k/month | With travel allowance |
| EMP009 | Robert Anderson | Operations Manager | R65k/month | With medical aid |
| EMP010 | Jennifer Thomas | Marketing Specialist | R38k/month | Standard with loan deduction |

**Employee Emails**: `{firstname}.{lastname}@demo.co.za` (e.g., `john.smith@demo.co.za`)

## Test Data Summary

### Legal Entity
- **Name**: Demo Company (Pty) Ltd
- **Code**: DEMO-ZA-001
- **Country**: ZA (South Africa)
- **Registration**: 2020/123456/07
- **Tax Reference**: 9012345678

### Pay Group
- **Name**: South Africa Monthly Payroll
- **Code**: ZA-MONTHLY-001
- **Frequency**: MONTHLY
- **Currency**: ZAR

### Pay Periods
- 12 pay periods created for 2025 (January - December)
- Pay dates: 1st of following month

### Pay Items
- **Earnings**: BASIC, OVERTIME, COMMISSION, BONUS, ALLOWANCE_TRAVEL, ALLOWANCE_CELL
- **Deductions**: PENSION_EE, MEDICAL_AID_EE, LOAN_REPAYMENT
- **Taxes**: PAYE, UIF_EE
- **Employer Contributions**: UIF_ER, SDL, PENSION_ER

### Tax Tables
- ZA PAYE 2025/2026 tax brackets
- UIF rates: 1% employee, 1% employer
- SDL rate: 1%

## Setting Up Test Credentials

### Option 1: Implement Login Endpoint (Recommended)

You need to implement a `/auth/login` endpoint that:
1. Accepts email and password
2. Validates password using bcrypt
3. Returns JWT token

Example implementation needed:
```typescript
@Post('login')
async login(@Body() dto: LoginDto) {
  // 1. Find user by email
  // 2. Compare password with bcrypt
  // 3. Generate JWT token
  // 4. Return token and user info
}
```

### Option 2: Update Seed File with Real Password Hash

1. Install bcrypt: `npm install bcrypt @types/bcrypt`
2. Generate a hash for your desired password (e.g., "admin123")
3. Update `prisma/seed.ts` line 80 with the real hash
4. Run the seed script: `npm run db:seed`

### Option 3: Generate JWT Tokens Manually for Testing

For API testing, you can generate JWT tokens manually using the JWT secret:
```bash
# JWT_SECRET from docker-compose.yml: dev-jwt-secret-change-in-production
```

### Option 4: Use Mock Tokens (E2E Tests)

The Playwright tests use mock tokens stored in localStorage:
```javascript
localStorage.setItem('token', 'mock-jwt-token');
localStorage.setItem('employee_id', 'test-employee-123');
localStorage.setItem('role', 'admin');
```

## Testing with Different Roles

To test with different roles:

1. **Create additional users in seed file**:
   ```typescript
   const payrollManager = await prisma.user.create({
     data: {
       email: 'manager@demo.workforce',
       passwordHash: '$2b$10$...', // proper hash
       firstName: 'Payroll',
       lastName: 'Manager',
       isActive: true,
     },
   });
   
   await prisma.userRole.create({
     data: {
       userId: payrollManager.id,
       roleId: roles.find(r => r.name === 'PAYROLL_MANAGER')!.id,
     },
   });
   ```

2. **Assign roles to existing users** via database or API

3. **Use different JWT tokens** with different role claims

## Notes

- ⚠️ **Login endpoint is missing** - needs to be implemented
- ⚠️ **Password hash is placeholder** - not a real bcrypt hash
- ✅ **Roles and permissions are seeded** - ready to use once login is implemented
- ✅ **Sample employees are created** - ready for payroll testing
- ✅ **All test data is for South Africa (ZA)** with ZAR currency
- ✅ **Legal Entity and Pay Group are created** - ready for payrun testing

## Next Steps

1. **Implement `/auth/login` endpoint** in `src/modules/auth/auth.controller.ts`
2. **Add password validation** using bcrypt in `src/modules/auth/auth.service.ts`
3. **Update seed file** with proper password hashes
4. **Test login flow** with the admin user
5. **Create additional test users** with different roles
