# Personal Expense Tracker (React + Express + MongoDB)

## Features
- Register and log in
- Add, list, filter, and delete expenses
- Create categories
- Set a monthly budget
- Warn at 80% budget use and when over budget
- Monthly totals and category breakdown
- Expenses and budgets are scoped to the logged-in user

## Requirements
Install Node.js (LTS) and use MongoDB locally or create a MongoDB Atlas database.

## 1. Start the backend
Open a terminal in `server`:
```bash
npm install
```
Copy `.env.example` to `.env`, then set `MONGO_URI` and `JWT_SECRET`.
```bash
npm run dev
```
The API runs at `http://localhost:5000`.

## 2. Start the frontend
Open a second terminal in `client`:
```bash
npm install
npm run dev
```
Open the URL Vite prints (normally `http://localhost:5173`).

Register a new account to start. Use your own test data; do not put real financial or bank credentials in this student demo.

## API routes
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET/POST `/api/expenses`
- DELETE `/api/expenses/:id`
- GET/POST `/api/categories`
- GET/PUT `/api/budgets/:month` where month is `YYYY-MM`
- GET `/api/summary?month=YYYY-MM`

## Notes
This is a learning project, not a production financial application. For a production app, add stronger rate limiting, password reset, deployment secrets management, tests, and additional security review.
