# External Workforce Platform - Frontend

**Production-Ready Next.js 15 Frontend with Complete External Workforce Platform Workflows**

Modern, full-featured frontend for the External Workforce Platform built with Next.js 15, TypeScript, Tailwind CSS, and Recharts. Includes complete CRUD operations, approval workflows, budget tracking, bulk operations, and advanced analytics.

---

## ✨ Features Overview

### 🎨 **Sprint 1: Core Workflows** ✅
- **Contractors Management**: Full CRUD with supplier linking
- **Contracts Management**: Rate configuration and date validation
- **Engagements Management**: Project assignments with auto-rate population
- **Timesheets Workflow**: Multi-entry forms, approval workflow, payment estimates

### 💰 **Sprint 2: Invoices & Projects** ✅
- **Invoice Management**: Create from timesheets, payment tracking, PDF generation
- **Projects**: Budget tracking with visual progress indicators and warnings

### 📊 **Sprint 3: Advanced Features** ✅
- **Interactive Dashboard**: 4 Recharts visualizations with real-time data
- **Bulk Operations**: Process multiple timesheets/invoices simultaneously
- **CSV Export**: Export all entities with proper formatting

---

## 🚀 Key Features

### Authentication & Security
- ✅ Login with JWT token management
- ✅ User registration with organization creation
- ✅ Protected routes with automatic redirect
- ✅ Persistent session via localStorage
- ✅ Auto-logout on 401 responses

### Dashboard Analytics
- ✅ Financial Overview (Bar Chart) - Invoiced vs Paid vs Pending
- ✅ Timesheet Status Distribution (Pie Chart)
- ✅ Project Status Breakdown (Pie Chart)
- ✅ Tax Withholding Breakdown (Horizontal Bar Chart)
- ✅ Real-time metrics and KPIs
- ✅ Responsive chart containers

### CRUD Operations
- ✅ **Contractors** (390 lines) - Supplier linking, contact info, tax details
- ✅ **Contracts** (420 lines) - Rate types (hourly/daily/monthly/fixed), date validation
- ✅ **Engagements** (385 lines) - Contract-based assignments, auto-rate population
- ✅ **Timesheets** (915 lines total):
  - List with status filtering (280 lines)
  - Multi-entry creation form (295 lines)
  - Detail view with approval workflow (340 lines)
- ✅ **Invoices** (1,185 lines total):
  - List with status filtering (368 lines)
  - Create from timesheets (338 lines)
  - Detail with payment workflow (479 lines)
- ✅ **Projects** (336 lines) - Budget tracking and utilization
- ✅ **Suppliers** (219 lines) - Reference implementation

### Workflow Management
- ✅ Multi-state workflows (Draft → Submitted → Approved/Rejected)
- ✅ Quick approve/reject actions
- ✅ Status-based filtering
- ✅ Approval history timeline
- ✅ Rejection reason tracking

### Bulk Operations
- ✅ Multi-select with checkboxes
- ✅ Select all/deselect all
- ✅ Bulk approve timesheets
- ✅ Bulk reject timesheets with reason
- ✅ Bulk approve invoices
- ✅ Success/failure reporting per operation
- ✅ Parallel processing with Promise.allSettled

### Data Export
- ✅ CSV export for all entities:
  - Timesheets (period, contractor, hours, status)
  - Invoices (amounts, payments, dates)
  - Contractors (contact info, tax details)
  - Contracts (rates, dates, status)
  - Projects (budget, utilization, metrics)
- ✅ Proper CSV escaping (commas, quotes, newlines)
- ✅ Date and currency formatting
- ✅ Exports filtered/searched data
- ✅ Auto-generated filenames with dates

### Budget Tracking
- ✅ Real-time budget utilization
- ✅ Visual progress bars
- ✅ Color-coded warnings:
  - Green (< 80%) - On track
  - Yellow (80-99%) - Approaching limit
  - Red (≥ 100%) - Budget exceeded
- ✅ Budget vs Spent vs Remaining display
- ✅ Alert indicators

### UI/UX Components
- ✅ Reusable Modal dialogs with keyboard navigation
- ✅ Form components (Input, Select, Textarea) with validation
- ✅ Status badges with auto-coloring
- ✅ Toast notification system (success/error/info)
- ✅ Loading states and error handling
- ✅ Responsive mobile design
- ✅ Search and filtering
- ✅ Pagination support

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 3
- **HTTP Client**: Axios
- **Charts**: Recharts 2.x
- **Icons**: Lucide React
- **State Management**: React Context API
- **Date Handling**: date-fns
- **Forms**: React Hook Form + Zod (ready to use)

---

## 📦 Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Running backend API** (http://localhost:3000)

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Update NEXT_PUBLIC_API_URL if needed
```

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Development Server

```bash
# Start development server
npm run dev
```

The frontend will be available at **http://localhost:3001**

### Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

---

## 📁 Project Structure

```
frontend/
├── app/                           # Next.js App Router pages
│   ├── dashboard/                 # Analytics dashboard with charts
│   │   └── page.tsx              # (450 lines)
│   ├── login/                     # Login page
│   │   └── page.tsx
│   ├── register/                  # Registration page
│   │   └── page.tsx
│   ├── contractors/               # Contractors CRUD
│   │   └── page.tsx              # (390 lines)
│   ├── contracts/                 # Contracts CRUD
│   │   └── page.tsx              # (420 lines)
│   ├── engagements/               # Engagements CRUD
│   │   └── page.tsx              # (385 lines)
│   ├── timesheets/                # Timesheets workflow
│   │   ├── page.tsx              # List (480 lines with bulk ops)
│   │   ├── new/                  # Create form
│   │   │   └── page.tsx          # (295 lines)
│   │   └── [id]/                 # Detail/approval
│   │       └── page.tsx          # (340 lines)
│   ├── invoices/                  # Invoice management
│   │   ├── page.tsx              # List (368 lines with bulk ops)
│   │   ├── new/                  # Create from timesheets
│   │   │   └── page.tsx          # (338 lines)
│   │   └── [id]/                 # Detail/payment
│   │       └── page.tsx          # (479 lines)
│   ├── projects/                  # Projects with budget tracking
│   │   └── page.tsx              # (336 lines)
│   ├── suppliers/                 # Suppliers management
│   │   └── page.tsx              # (219 lines)
│   ├── layout.tsx                 # Root layout with providers
│   ├── page.tsx                   # Home (redirects)
│   └── globals.css                # Global styles and utilities
│
├── components/                    # React components
│   ├── dashboard-layout.tsx       # Main layout with sidebar (153 lines)
│   └── ui/                        # Reusable UI components
│       ├── modal.tsx              # Modal dialog with keyboard nav
│       ├── form-input.tsx         # Form input with validation
│       ├── form-select.tsx        # Dropdown select
│       ├── form-textarea.tsx      # Multi-line input
│       ├── status-badge.tsx       # Auto-colored status indicators
│       └── budget-progress.tsx    # Budget visualization (89 lines)
│
├── lib/                           # Utilities and services
│   ├── api.ts                     # API client (240+ lines)
│   ├── auth-context.tsx           # Authentication provider
│   ├── toast.tsx                  # Toast notification system
│   └── csv-export.ts              # CSV export utilities (260 lines)
│
├── public/                        # Static assets
├── next.config.js                 # Next.js configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json
```

**Total Frontend Code**: ~6,000+ lines across 30+ files

---

## 🔌 API Integration

The frontend communicates with the NestJS backend via the API client (`lib/api.ts`).

### Available API Methods

**Authentication:**
```typescript
api.register(data)                 // Register user + organization
api.login(email, password)         // Login and get JWT
api.getProfile()                   // Get current user
```

**Contractors:**
```typescript
api.getContractors(params)         // List with pagination
api.createContractor(data)         // Create new contractor
api.updateContractor(id, data)     // Update contractor
api.deleteContractor(id)           // Delete contractor
```

**Contracts:**
```typescript
api.getContracts(params)
api.createContract(data)
api.updateContract(id, data)
api.deleteContract(id)
```

**Engagements:**
```typescript
api.getEngagements(params)
api.createEngagement(data)
api.updateEngagement(id, data)
```

**Timesheets:**
```typescript
api.getTimesheets(params)
api.createTimesheet(data)
api.updateTimesheet(id, data)
api.submitTimesheet(id)            // Submit for approval
api.approveTimesheet(id)           // Approve
api.rejectTimesheet(id, reason)    // Reject with reason
```

**Invoices:**
```typescript
api.getInvoices(params)
api.createInvoice(data)
api.submitInvoice(id)              // Submit for approval
api.approveInvoice(id)             // Approve
api.markInvoicePaid(id, data)      // Mark as paid
api.voidInvoice(id, reason)        // Void with reason
api.downloadInvoicePDF(id)         // Download PDF
```

**Projects:**
```typescript
api.getProjects(params)
api.createProject(data)
api.updateProject(id, data)
api.getProjectBudgetUtilization(id)
```

**Analytics:**
```typescript
api.getDashboardAnalytics(params)  // All dashboard metrics
api.getFinancialAnalytics(params)  // Financial summary
api.getContractorAnalytics()       // Contractor metrics
api.getProjectAnalytics()          // Project metrics
```

---

## 🔐 Authentication Flow

1. User visits protected page
2. `AuthProvider` checks localStorage for token
3. If no token → redirect to `/login`
4. On successful login:
   - Save JWT token to localStorage
   - Save user object to localStorage
   - Set user in React Context
   - Redirect to `/dashboard`
5. All API requests include `Authorization: Bearer <token>`
6. On 401 response → clear session and redirect to `/login`

---

## 🎨 Component Architecture

### Layout System

**Root Layout** (`app/layout.tsx`):
- Wraps app with `AuthProvider` and `ToastProvider`
- Sets up global fonts and styles

**Dashboard Layout** (`components/dashboard-layout.tsx`):
- Sidebar navigation with 10 links
- Mobile responsive hamburger menu
- User profile header
- Logout button
- Automatic authentication check

### Protected Routes

Wrap pages with `DashboardLayout`:

```tsx
<DashboardLayout>
  {/* Your page content */}
</DashboardLayout>
```

### Reusable Components

**Modal** (`components/ui/modal.tsx`):
```tsx
<Modal isOpen={show} onClose={() => setShow(false)} title="Edit Item">
  {/* Form content */}
</Modal>
```

**Form Components**:
```tsx
<FormInput
  label="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={errors.email}
  required
/>

<FormSelect
  label="Status"
  value={status}
  onChange={(e) => setStatus(e.target.value)}
  options={[{ value: 'ACTIVE', label: 'Active' }]}
/>
```

**Status Badge**:
```tsx
<StatusBadge status="APPROVED" /> {/* Auto-colors green */}
<StatusBadge status="PENDING" />  {/* Auto-colors yellow */}
<StatusBadge status="REJECTED" /> {/* Auto-colors red */}
```

**Toast Notifications**:
```tsx
const { showToast } = useToast();
showToast('success', 'Item saved successfully');
showToast('error', 'Failed to save item');
```

**Budget Progress**:
```tsx
<BudgetProgress
  budget={100000}
  spent={75000}
  currency="ZAR"
  showAmounts={true}
  size="md"
/>
```

---

## 🎨 Styling Guidelines

### Tailwind Utility Classes

Defined in `globals.css`:

**Buttons:**
- `.btn` - Base button styles
- `.btn-primary` - Primary actions (blue)
- `.btn-secondary` - Secondary actions (gray)
- `.btn-danger` - Destructive actions (red)

**Forms:**
- `.input` - Text input fields
- `.label` - Form labels
- `.card` - Container with shadow and border

### Color Scheme

**Primary (Blue):**
- Used for primary actions, links, charts
- Scale: 50-900 defined in `tailwind.config.ts`

**Status Colors:**
- **Green**: Success, Active, Approved
- **Yellow**: Pending, Warning, Approaching limit
- **Red**: Error, Rejected, Exceeded
- **Gray**: Neutral, Inactive, Draft

---

## 📊 Sprint Breakdown

### Sprint 1: Core Workflows (2,612 lines)
**Components Created (6):**
- Modal, FormInput, FormSelect, FormTextarea, StatusBadge, Toast

**Pages Created (6):**
- Contractors (390 lines)
- Contracts (420 lines)
- Engagements (385 lines)
- Timesheets List (280 lines)
- Timesheets Create (295 lines)
- Timesheets Detail (340 lines)

### Sprint 2: Invoices & Projects (1,610 lines)
**Pages Created (4):**
- Invoices List (368 lines)
- Invoices Create (338 lines)
- Invoices Detail (479 lines)
- Projects (336 lines)

**Components Created (1):**
- BudgetProgress (89 lines)

### Sprint 3: Advanced Features (+813 lines)
**Enhanced Features:**
- Dashboard with 4 Recharts visualizations
- Bulk operations for timesheets and invoices
- CSV export utility and buttons on all pages

---

## 📝 Available Scripts

```bash
# Development
npm run dev          # Start dev server on port 3001

# Production
npm run build        # Build for production
npm start            # Start production server

# Linting
npm run lint         # Run ESLint
```

---

## 🔍 Troubleshooting

### API Connection Issues

**CORS Errors:**
1. Ensure backend is running on port 3000
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check backend CORS configuration (`CORS_ORIGIN=http://localhost:3001`)

### Authentication Issues

**Logged Out Unexpectedly:**
1. Check JWT token expiration (default: 1 day)
2. Clear localStorage: `localStorage.clear()`
3. Verify backend `/auth` endpoints are working

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Regenerate lock file
npm install --package-lock-only
```

### Chart Not Rendering

- Ensure data is loaded before rendering
- Check console for Recharts errors
- Verify data format matches chart requirements

---

## 🚀 Performance Optimizations

- ✅ Server-side rendering (SSR) via Next.js
- ✅ Automatic code splitting
- ✅ Image optimization
- ✅ Font optimization (Inter font)
- ✅ Lazy loading for routes
- ✅ Debounced search inputs (ready to implement)
- ✅ Memoized components (ready to implement)

---

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## 🗺️ Future Enhancements

**Potential Sprint 4+:**
- [ ] Email notifications for approvals
- [ ] Advanced filtering (date ranges, multi-select)
- [ ] User permissions & roles UI
- [ ] Audit logs display
- [ ] Real-time notifications (WebSockets)
- [ ] Dark mode toggle
- [ ] Multi-language support (i18n)
- [ ] Progressive Web App (PWA)
- [ ] Offline support with service workers
- [ ] Advanced analytics with custom date ranges
- [ ] Drag-and-drop file uploads
- [ ] Real-time collaboration features
- [ ] Mobile app (React Native)

---

## 🤝 Contributing

**Code Style:**
1. Use TypeScript for type safety
2. Follow existing component patterns
3. Use Tailwind CSS conventions
4. Test on multiple screen sizes
5. Ensure authentication is preserved
6. Add proper error handling
7. Include loading states

**Component Guidelines:**
- Keep components under 500 lines
- Extract reusable logic to hooks
- Use consistent naming (PascalCase for components)
- Add TypeScript interfaces for props
- Handle loading and error states

---

## 📄 License

ISC

---

Built with ❤️ using Next.js 15, TypeScript, Tailwind CSS, and Recharts
