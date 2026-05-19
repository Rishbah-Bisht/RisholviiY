# RisholviiY

Full-stack Previous Year Question Paper management app.

## Stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose ObjectId references
- Auth: Email/password, Google OAuth, JWT sessions
- Uploads: Institute logos by file upload or image URL, and PYQ PDFs through Multer

## Features

- Default Super Admin: `rishukie@admin.in` / `12345678`
- Institute -> Course -> Semester -> Subject -> PYQ hierarchy
- Super Admin CRUD for institutes, courses, semesters, subjects, users, and PYQs
- Limited Admins scoped to assigned institute/course pairs
- JWT protected API routes with role and course-scope authorization
- Cascading deletes for institute, course, semester, and subject removal
- Responsive dashboard with search filters and PDF upload

## Setup

1. Install dependencies:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

2. Create backend environment:

```bash
copy backend\.env.example backend\.env
```

Set `MONGO_URI`, `JWT_SECRET`, and optionally Google OAuth credentials.
`MONGODB_URI` plus `MONGODB_DB_NAME` is also supported.

3. Create frontend environment:

```bash
copy frontend\.env.example frontend\.env.local
```

4. Seed the default Super Admin:

```bash
npm run seed
```

5. Run both apps:

```bash
npm run dev
```

Frontend: `http://localhost:3000`  
Backend API: `http://localhost:5000/api`

## Google Authentication

Add these values in `backend/.env` to enable Google login:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
CLIENT_URL=http://localhost:3000
```

The backend also accepts `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and
`AUTH_GOOGLE_CALLBACK_URL` if you prefer that naming style.

Without these credentials, email/password auth remains fully available.
