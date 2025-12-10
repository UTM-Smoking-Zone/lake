# Authentication System

## Overview

This project now includes a complete authentication system with:
- **Backend**: NestJS with JWT authentication
- **Frontend**: Next.js with login/register pages

## Features

### Backend (NestJS)
- User registration with email validation
- User login with JWT tokens
- Password hashing with bcrypt
- Protected routes using JWT guards
- User profile endpoint

### Frontend (Next.js)
- Beautiful login/register page with dark theme
- Client-side authentication context
- Protected routes (dashboard)
- Automatic redirection based on auth state
- Token management with localStorage

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd platform/back
```

2. Install dependencies (already done):
```bash
npm install
```

3. Start the development server:
```bash
npm run start:dev
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd platform/front
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Authentication Endpoints

#### Register
- **POST** `/auth/register`
- Body:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```
- Response:
```json
{
  "access_token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Login
- **POST** `/auth/login`
- Body:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
- Response: Same as register

#### Get Profile (Protected)
- **GET** `/auth/profile`
- Headers: `Authorization: Bearer <token>`
- Response:
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

## Pages

### `/` (Home)
- Redirects to `/auth` if not logged in
- Redirects to `/dashboard` if logged in

### `/auth` (Login/Register)
- Login and registration forms
- Toggle between login and register modes
- Form validation
- Error handling

### `/dashboard` (Protected)
- Accessible only when logged in
- Displays user information
- Shows BTC/USDT trading chart
- Logout functionality

## Environment Variables

### Backend
Create a `.env` file in `platform/back/`:
```env
JWT_SECRET=your-secret-key-change-in-production
PORT=3001
```

### Frontend
Create a `.env.local` file in `platform/front/`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Security Notes

1. **JWT Secret**: Change the JWT secret in production
2. **Password Requirements**: Minimum 6 characters (can be increased)
3. **CORS**: Currently allows all origins - restrict in production
4. **Data Storage**: Currently uses in-memory storage - integrate a database for production

## Next Steps

1. **Database Integration**: Replace in-memory user storage with a real database (PostgreSQL, MongoDB, etc.)
2. **Refresh Tokens**: Implement refresh token mechanism
3. **Email Verification**: Add email verification flow
4. **Password Reset**: Implement password reset functionality
5. **Social Auth**: Add OAuth providers (Google, GitHub, etc.)
6. **Rate Limiting**: Add rate limiting to prevent abuse
7. **Input Sanitization**: Add additional security measures

## Testing

### Test Registration
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Test Profile (use token from login)
```bash
curl -X GET http://localhost:3001/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
