# Employee Self-Service Portal

A modern, responsive self-service portal for employees to access their payroll information securely.

## 🎯 Features

- **Dashboard** - YTD earnings summary and quick access to key features
- **Payslips** - View and download monthly payslips as PDF
- **Tax Certificates** - Download annual tax certificates (IRP5/IT3a)
- **Profile** - View personal, employment, and bank account information
- **Leave Balances** - Check available leave days
- **Change Requests** - Submit requests for contact info or bank account updates
- **Time Tracking** ⭐ NEW - Clock in/out with live working time counter and attendance history
- **My Benefits** - View and manage benefit enrollments
- **My Loans** - View loan applications and repayment schedules
- **My Goals** - Track performance goals and progress
- **Secure Authentication** - JWT-based login with automatic token refresh
- **Mobile Responsive** - Works seamlessly on desktop, tablet, and mobile devices

## 🚀 Tech Stack

- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client with interceptors
- **Lucide React** - Beautiful icon library
- **date-fns** - Modern date utility library

## 📋 Prerequisites

- Node.js 18+ and npm
- Hubsec Workforce Platform API running (default: http://localhost:3000)

## 🛠️ Installation

1. **Install dependencies**

```bash
npm install
```

2. **Configure environment**

Copy `.env.example` to `.env` and update the API base URL:

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```

3. **Start development server**

```bash
npm run dev
```

The portal will be available at `http://localhost:5173`

## 📦 Build for Production

```bash
npm run build
```

The optimized build will be in the `dist/` directory.

Preview the production build:

```bash
npm run preview
```

## 🔐 Authentication

The portal uses JWT authentication with the following flow:

1. User logs in with email and password
2. API returns JWT access token
3. Token is stored in `localStorage`
4. Axios interceptor adds token to all requests
5. On 401 response, user is redirected to login

## 📱 API Endpoints Used

The portal connects to the following API endpoints:

### Authentication & Profile
- `POST /auth/login` - User authentication
- `GET /auth/me` - Get current user info
- `GET /self-service/profile` - Employee profile
- `POST /self-service/change-requests/contact` - Submit contact info change
- `POST /self-service/change-requests/bank-account` - Submit bank account change

### Payroll & Tax
- `GET /self-service/payslips` - List payslips
- `GET /self-service/payslips/:id/download` - Download payslip PDF
- `GET /self-service/tax-certificates` - List tax certificates
- `GET /self-service/tax-certificates/:id/download` - Download certificate PDF

### Time & Attendance ⭐ NEW
- `POST /api/time-attendance/clock-in` - Clock in for the day
- `POST /api/time-attendance/clock-out` - Clock out for the day
- `GET /api/time-attendance/status` - Get current attendance status
- `GET /api/time-attendance/attendance/:employee_id` - Get attendance records
- `GET /api/time-attendance/summary/:employee_id/:month` - Get monthly summary

### Benefits
- `GET /api/benefits/enrollments` - Get my benefit enrollments
- `POST /api/benefits/enrollments` - Enroll in benefit plan
- `GET /api/benefits/plans` - Get available benefit plans

### Loans
- `GET /api/loans/applications` - Get my loan applications
- `POST /api/loans/applications` - Submit loan application
- `GET /api/loans/active/:id/schedule` - Get repayment schedule

### Performance
- `GET /api/performance/goals` - Get my goals
- `POST /api/performance/goals` - Create personal goal
- `PUT /api/performance/goals/:id/progress` - Update goal progress

## 🎨 Customization

### Branding

Update the branding in `src/components/Layout.tsx`:

```tsx
<h1 className="text-2xl font-bold text-blue-600">Your Company Name</h1>
```

### Colors

Tailwind colors can be customized in `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      primary: {...},
      secondary: {...}
    }
  }
}
```

### Navigation

Add or remove navigation items in `src/components/Layout.tsx`:

```tsx
const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  // Add your custom pages here
];
```

## 📂 Project Structure

```
employee-portal/
├── src/
│   ├── components/       # Reusable components
│   │   └── Layout.tsx    # Main layout with navigation
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx  # Authentication state management
│   ├── pages/            # Page components
│   │   ├── Login.tsx     # Login page
│   │   ├── Dashboard.tsx # Dashboard with YTD stats
│   │   ├── Payslips.tsx  # Payslip list and download
│   │   ├── Profile.tsx   # Employee profile
│   │   ├── TaxCertificates.tsx  # Tax certificates
│   │   ├── ChangeRequests.tsx   # Change request forms
│   │   ├── TimeTracking.tsx     # Clock in/out interface ⭐ NEW
│   │   ├── MyBenefits.tsx       # Benefit enrollments
│   │   ├── MyLoans.tsx          # Loan applications
│   │   └── MyGoals.tsx          # Performance goals
│   ├── services/         # API services
│   │   └── api.ts        # Axios instance with interceptors
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts      # Shared types
│   ├── App.tsx           # Main app component with routing
│   └── main.tsx          # Entry point
├── public/               # Static assets
├── .env                  # Environment configuration
└── package.json          # Dependencies
```

## 🔧 Development

### Code Style

The project uses ESLint for code quality. Run linter:

```bash
npm run lint
```

### TypeScript

Type checking:

```bash
npx tsc --noEmit
```

## 🚢 Deployment

### Option 1: Static Hosting (Netlify, Vercel, etc.)

1. Build the project: `npm run build`
2. Deploy the `dist/` directory
3. Configure environment variables in your hosting platform

### Option 2: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build -t employee-portal .
docker run -p 80:80 employee-portal
```

## 🔒 Security Considerations

1. **Environment Variables** - Never commit `.env` files with real credentials
2. **JWT Tokens** - Tokens are stored in localStorage (consider httpOnly cookies for production)
3. **HTTPS** - Always use HTTPS in production
4. **CORS** - Configure backend CORS to only allow your frontend domain
5. **Content Security Policy** - Add CSP headers in production

## 📝 License

This project is part of the Hubsec Workforce Platform.

## 🤝 Support

For issues or questions:
- Contact your IT/HR department
- Check the API documentation at `http://localhost:3000/api`
