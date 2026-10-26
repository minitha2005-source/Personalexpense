import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true }
}, { timestamps: true });

const expenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: String, required: true }, // YYYY-MM-DD
  category: { type: String, required: true, trim: true },
  paymentMode: { type: String, required: true, enum: ["Cash", "UPI", "Card", "Bank Transfer", "Other"] },
  description: { type: String, trim: true, maxlength: 200, default: "" }
}, { timestamps: true });

const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true }
}, { timestamps: true });
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  amount: { type: Number, required: true, min: 0.01 }
}, { timestamps: true });
budgetSchema.index({ userId: 1, month: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
const Expense = mongoose.model("Expense", expenseSchema);
const Category = mongoose.model("Category", categorySchema);
const Budget = mongoose.model("Budget", budgetSchema);

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    if (!token) return res.status(401).json({ message: "Please log in." });
    req.userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}
function validMonth(month) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(month || ""); }

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !email || password.length < 8)
      return res.status(400).json({ message: "Name, email, and a password of at least 8 characters are required." });
    if (await User.findOne({ email })) return res.status(409).json({ message: "An account with this email already exists." });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const defaults = ["Food", "Transport", "Education", "Shopping", "Bills", "Health", "Other"];
    await Category.insertMany(defaults.map(name => ({ userId: user._id, name })));
    res.status(201).json({ token, user: { name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ message: "Could not create account." }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ message: "Email or password is incorrect." });
    const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch { res.status(500).json({ message: "Could not log in." }); }
});

app.get("/api/categories", auth, async (req, res) => {
  res.json(await Category.find({ userId: req.userId }).sort({ name: 1 }).select("name"));
});
app.post("/api/categories", auth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 40) return res.status(400).json({ message: "Enter a category name (1–40 characters)." });
    const category = await Category.create({ userId: req.userId, name });
    res.status(201).json(category);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: "That category already exists." });
    res.status(500).json({ message: "Could not add category." });
  }
});

app.get("/api/expenses", auth, async (req, res) => {
  const filter = { userId: req.userId };
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = String(req.query.from);
    if (req.query.to) filter.date.$lte = String(req.query.to);
  }
  if (req.query.category) filter.category = String(req.query.category);
  if (req.query.paymentMode) filter.paymentMode = String(req.query.paymentMode);
  const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
  const limit = 50;
  const [items, total] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Expense.countDocuments(filter)
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});
app.post("/api/expenses", auth, async (req, res) => {
  try {
    const { amount, date, category, paymentMode, description = "" } = req.body;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ message: "Amount must be greater than zero." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")))
      return res.status(400).json({ message: "Choose a valid date." });
    if (!String(category || "").trim() || !["Cash", "UPI", "Card", "Bank Transfer", "Other"].includes(paymentMode))
      return res.status(400).json({ message: "Choose a category and valid payment mode." });
    const categoryExists = await Category.findOne({ userId: req.userId, name: String(category).trim() });
    if (!categoryExists) return res.status(400).json({ message: "Choose one of your categories." });
    const item = await Expense.create({
      userId: req.userId, amount: Number(amount), date, category: String(category).trim(),
      paymentMode, description: String(description).trim()
    });
    res.status(201).json(item);
  } catch { res.status(500).json({ message: "Could not save expense." }); }
});
app.delete("/api/expenses/:id", auth, async (req, res) => {
  const item = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!item) return res.status(404).json({ message: "Expense not found." });
  res.json({ message: "Expense deleted." });
});

app.get("/api/budgets/:month", auth, async (req, res) => {
  if (!validMonth(req.params.month)) return res.status(400).json({ message: "Month must be YYYY-MM." });
  const budget = await Budget.findOne({ userId: req.userId, month: req.params.month });
  res.json({ amount: budget?.amount || 0, month: req.params.month });
});
app.put("/api/budgets/:month", auth, async (req, res) => {
  if (!validMonth(req.params.month)) return res.status(400).json({ message: "Month must be YYYY-MM." });
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Budget must be greater than zero." });
  const budget = await Budget.findOneAndUpdate(
    { userId: req.userId, month: req.params.month },
    { $set: { amount } }, { new: true, upsert: true, runValidators: true }
  );
  res.json(budget);
});

app.get("/api/summary", auth, async (req, res) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  if (!validMonth(month)) return res.status(400).json({ message: "Month must be YYYY-MM." });
  const start = `${month}-01`;
  const endDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0);
  const end = `${month}-${String(endDate.getDate()).padStart(2, "0")}`;
  const grouped = await Expense.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(req.userId), date: { $gte: start, $lte: end } } },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);
  const total = grouped.reduce((sum, row) => sum + row.total, 0);
  const budget = await Budget.findOne({ userId: req.userId, month });
  const budgetAmount = budget?.amount || 0;
  res.json({
    month, total, budget: budgetAmount, remaining: budgetAmount - total,
    usagePercent: budgetAmount ? Math.round(total / budgetAmount * 100) : 0,
    categories: grouped
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error." });
});

const port = process.env.PORT || 5000;
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing. Copy .env.example to .env and set it.");
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/personal_expense_tracker")
  .then(() => app.listen(port, () => console.log(`API running at http://localhost:${port}`)))
  .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
