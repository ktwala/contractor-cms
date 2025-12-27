# Contractor CMS - Frontend

Modern Next.js frontend for the Contractor Management System with TypeScript, Tailwind CSS, and comprehensive dashboard analytics.

## Features

### Authentication
- **Login**: Secure user authentication with JWT tokens
- **Register**: New user and organization registration
- **Protected Routes**: Automatic redirect for unauthenticated users
- **Session Management**: Persistent authentication via localStorage

### Dashboard
- **Financial Summary**: Total invoiced, paid, and pending amounts
- **Contractor Metrics**: Active/inactive contractors and engagement counts
- **Project Overview**: Budget tracking and utilization percentages
- **Timesheet Status**: Approval workflow metrics
- **Tax Summary**: SARS withholding breakdown (PAYE, SDL, UIF)

### Modules Implemented
✅ **Authentication** - Login, Register, Logout
✅ **Dashboard** - Analytics visualization
✅ **Suppliers** - List, search, CRUD operations (reference implementation)

### Modules Ready for Implementation
- Contractors
- Contracts
- Engagements
- Timesheets (with approval workflow)
- Invoices
- Projects
- Withholding Instructions
- Organizations

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **State Management**: React Context API
- **Forms**: React Hook Form + Zod (ready to use)
- **Charts**: Recharts (ready to use)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Running backend API (http://localhost:3000)

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Development Server

```bash
# Start development server
npm run dev
```

The frontend will be available at [http://localhost:3001](http://localhost:3001)

### Build for Production

```bash
# Build
npm run build

# Start production server
npm start
```

## Project Structure

```
frontend/
├── app/                      # Next.js App Router pages
│   ├── dashboard/           # Dashboard page with analytics
│   ├── login/               # Login page
│   ├── register/            # Registration page
│   ├── suppliers/           # Suppliers management
│   ├── layout.tsx           # Root layout with AuthProvider
│   ├── page.tsx             # Home page (redirects)
│   └── globals.css          # Global styles
├── components/              # Reusable React components
│   └── dashboard-layout.tsx # Main layout with navigation
├── lib/                     # Utilities and services
│   ├── api.ts              # API client with all endpoints
│   └── auth-context.tsx    # Authentication context provider
├── public/                  # Static assets
├── next.config.js          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## API Integration

The frontend communicates with the NestJS backend via the API client (`lib/api.ts`).

### Available API Methods

**Authentication:**
- `api.register(data)` - Register new user and organization
- `api.login(email, password)` - Login and get JWT token
- `api.getProfile()` - Get current user profile

**Suppliers:**
- `api.getSuppliers(params)` - List suppliers with pagination
- `api.getSupplier(id)` - Get supplier details
- `api.createSupplier(data)` - Create new supplier
- `api.updateSupplier(id, data)` - Update supplier
- `api.deleteSupplier(id)` - Delete supplier

**Contractors:**
- `api.getContractors(params)`
- `api.createContractor(data)`
- `api.updateContractor(id, data)`
- etc.

**Analytics:**
- `api.getDashboardAnalytics(params)` - Get all dashboard metrics
- `api.getFinancialAnalytics(params)` - Financial summary
- `api.getContractorAnalytics()` - Contractor metrics
- `api.getProjectAnalytics()` - Project metrics

## Authentication Flow

1. User visits any protected page
2. `AuthProvider` checks for saved token in localStorage
3. If no token, redirect to `/login`
4. On successful login:
   - Save JWT token to localStorage
   - Save user object to localStorage
   - Set user in React Context
   - Redirect to `/dashboard`
5. All API requests include Authorization header
6. On 401 response, clear session and redirect to `/login`

## Component Architecture

### Layout System

- **Root Layout** (`app/layout.tsx`): Wraps entire app with AuthProvider
- **Dashboard Layout** (`components/dashboard-layout.tsx`):
  - Sidebar navigation
  - Mobile responsive menu
  - User profile header
  - Logout button

### Protected Routes

Pages automatically check authentication via the `DashboardLayout` component:

```tsx
<DashboardLayout>
  {/* Your page content */}
</DashboardLayout>
```

## Styling Guidelines

### Tailwind Utility Classes

Common component classes defined in `globals.css`:

- `.btn` - Base button styles
- `.btn-primary` - Primary action buttons
- `.btn-secondary` - Secondary buttons
- `.btn-danger` - Destructive actions
- `.card` - Card container
- `.input` - Form input fields
- `.label` - Form labels

### Color Scheme

Primary colors (Blue):
- 50-900 scale defined in `tailwind.config.ts`
- Primary: `#3b82f6` (blue-500)

Status colors:
- Green: Success, Active, Approved
- Yellow: Pending, Warning
- Red: Error, Rejected, Danger
- Gray: Neutral, Inactive

## Next Steps for Development

### 1. Complete CRUD Pages

Use the suppliers page as a reference to implement:
- Contractors page
- Contracts page
- Engagements page
- Projects page

### 2. Implement Forms

Use React Hook Form + Zod for validation:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  // ...
});

const { register, handleSubmit } = useForm({
  resolver: zodResolver(schema),
});
```

### 3. Add Charts

Use Recharts for data visualization on dashboard:

```tsx
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
```

### 4. Implement Timesheets Workflow

Create timesheet pages with:
- Timesheet entry form
- Submit button
- Approve/Reject actions
- Status badges

### 5. Add Invoice Management

- Invoice creation from timesheets
- Mark as paid/void
- PDF generation

## Available Scripts

```bash
# Development
npm run dev          # Start development server on port 3001

# Production
npm run build        # Build for production
npm start            # Start production server

# Linting
npm run lint         # Run ESLint
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- Server-side rendering (SSR) via Next.js
- Automatic code splitting
- Image optimization
- Font optimization (Inter font)

## Future Enhancements

- [ ] Real-time notifications
- [ ] Advanced filtering and sorting
- [ ] Bulk operations
- [ ] Export to CSV/Excel
- [ ] Dark mode
- [ ] Multi-language support
- [ ] Progressive Web App (PWA)
- [ ] Offline support
- [ ] Advanced charts and visualizations
- [ ] PDF generation client-side
- [ ] Drag-and-drop file uploads
- [ ] Real-time collaboration

## Troubleshooting

### API Connection Issues

If you get CORS errors:
1. Check backend is running on port 3000
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check backend CORS configuration

### Authentication Issues

If you get logged out unexpectedly:
1. Check JWT token expiration
2. Clear localStorage and login again
3. Verify backend `/auth` endpoints

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Follow Tailwind CSS conventions
4. Test on multiple screen sizes
5. Ensure authentication is preserved

## License

ISC
