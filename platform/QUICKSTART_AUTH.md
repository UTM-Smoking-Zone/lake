# Quick Start Guide - Authentication System

## 🚀 Both servers are running!

### Backend (NestJS)
- **URL**: http://localhost:3001
- **Status**: ✅ Running
- **Endpoints**:
  - POST `/auth/register` - Register new user
  - POST `/auth/login` - Login user
  - GET `/auth/profile` - Get user profile (protected)

### Frontend (Next.js)
- **URL**: http://localhost:3000
- **Status**: ✅ Running
- **Pages**:
  - `/` - Home (redirects to auth or dashboard)
  - `/auth` - Login/Register page
  - `/dashboard` - Protected dashboard with trading chart

## 📝 How to Use

1. **Open your browser** and go to: http://localhost:3000

2. **You'll be redirected to the login page** (`/auth`)

3. **Create a new account**:
   - Click "Sign up" if you don't have an account
   - Fill in email, password, first name, and last name
   - Click "Sign Up"

4. **Or login** with existing credentials:
   - Email: test@example.com
   - Password: password123

5. **After login**, you'll be redirected to the dashboard where you can see:
   - Your user information in the header
   - Real-time BTC/USDT candlestick chart
   - A logout button

## 🎨 Features Implemented

### Authentication
✅ User registration with email validation
✅ User login with JWT tokens
✅ Password hashing (bcrypt)
✅ Protected routes
✅ Automatic token management
✅ Profile retrieval

### UI/UX
✅ Modern dark theme
✅ Responsive design
✅ Form validation
✅ Error handling
✅ Loading states
✅ Smooth transitions

## 🔧 To Stop the Servers

1. Backend: Go to the terminal and press `Ctrl+C`
2. Frontend: Go to the terminal and press `Ctrl+C`

## 🔄 To Restart

**Backend:**
```bash
cd /root/lake/platform/back && npm run start:dev
```

**Frontend:**
```bash
cd /root/lake/platform/front && npm run dev
```

## 📁 File Structure

### Backend (`platform/back/src/`)
```
auth/
├── entities/
│   └── user.entity.ts           # User data model
├── dto/
│   ├── login.dto.ts             # Login validation
│   └── register.dto.ts          # Registration validation
├── auth.controller.ts           # API endpoints
├── auth.service.ts              # Business logic
├── auth.module.ts               # Module configuration
├── users.service.ts             # User management
├── jwt.strategy.ts              # JWT strategy
└── jwt-auth.guard.ts            # Route protection
```

### Frontend (`platform/front/src/`)
```
contexts/
└── AuthContext.tsx              # Global auth state
app/
├── page.tsx                     # Home with redirect
├── auth/
│   └── page.tsx                 # Login/Register page
└── dashboard/
    └── page.tsx                 # Protected dashboard
```

## 🔐 Security Notes

- JWT tokens are stored in localStorage
- Passwords are hashed with bcrypt
- All authentication endpoints are on the backend
- CORS is enabled for development

## 📚 Next Steps

See `AUTH_README.md` for detailed documentation about:
- API endpoints with examples
- Security recommendations
- Production deployment
- Database integration
- Additional features to implement

Enjoy your new authentication system! 🎉
