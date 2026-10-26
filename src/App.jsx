import React from 'react';
import { useCallback, useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000/api";
const today = () => new Date().toLocaleDateString("en-CA");
const thisMonth = () => new Date().toISOString().slice(0, 7);
const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("expenseToken") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("expenseUser") || "null"));
  const [mode, setMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ total: 0, budget: 0, remaining: 0, usagePercent: 0, categories: [] });
  const [month, setMonth] = useState(thisMonth());
  const [budgetInput, setBudgetInput] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", category: "", paymentMode: "" });
  const [form, setForm] = useState({ amount: "", date: today(), category: "", paymentMode: "UPI", description: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const query = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      const [expenseData, categoryData, summaryData, budgetData] = await Promise.all([
        api(`/expenses?${query}`), api("/categories"), api(`/summary?month=${month}`), api(`/budgets/${month}`)
      ]);
      setExpenses(expenseData.items);
      setCategories(categoryData);
      setSummary(summaryData);
      setBudgetInput(budgetData.amount ? String(budgetData.amount) : "");
      setForm(old => ({ ...old, category: old.category || categoryData[0]?.name || "" }));
    } catch (e) { setMessage(e.message); }
  }, [api, token, filters, month]);

  useEffect(() => { refresh(); }, [refresh]);

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(authForm) });
      localStorage.setItem("expenseToken", data.token);
      localStorage.setItem("expenseUser", JSON.stringify(data.user));
      setToken(data.token); setUser(data.user); setMessage(`Welcome, ${data.user.name}!`);
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  function logout() {
    localStorage.removeItem("expenseToken"); localStorage.removeItem("expenseUser");
    setToken(""); setUser(null); setExpenses([]); setMessage("You have logged out.");
  }
  async function addExpense(e) {
    e.preventDefault(); setMessage("");
    try {
      await api("/expenses", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
      setForm(old => ({ ...old, amount: "", description: "", date: today() }));
      setMessage("Expense added successfully."); await refresh();
    } catch (e) { setMessage(e.message); }
  }
  async function deleteExpense(id) {
    if (!window.confirm("Delete this expense?")) return;
    try { await api(`/expenses/${id}`, { method: "DELETE" }); setMessage("Expense deleted."); await refresh(); }
    catch (e) { setMessage(e.message); }
  }
  async function saveBudget(e) {
    e.preventDefault();
    try { await api(`/budgets/${month}`, { method: "PUT", body: JSON.stringify({ amount: Number(budgetInput) }) }); setMessage("Monthly budget saved."); await refresh(); }
    catch (e) { setMessage(e.message); }
  }
  async function addCategory(e) {
    e.preventDefault();
    try {
      const data = await api("/categories", { method: "POST", body: JSON.stringify({ name: newCategory }) });
      setCategories(old => [...old, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(old => ({ ...old, category: data.name })); setNewCategory(""); setMessage("Category added.");
    } catch (e) { setMessage(e.message); }
  }

  const budgetStatus = useMemo(() => {
    if (!summary.budget) return "Set a monthly budget to track your progress.";
    if (summary.total > summary.budget) return "Budget exceeded! Review your spending.";
    if (summary.usagePercent >= 80) return "Warning: you have used at least 80% of your budget.";
    return "You are within your monthly budget.";
  }, [summary]);

  if (!token) return <main className="auth-page">
    <section className="auth-card">
      <div className="logo">₹</div><p className="eyebrow">SMART MONEY HABITS</p>
      <h1>Personal Expense Tracker</h1><p className="muted">Keep your spending clear, simple, and organised.</p>
      <div className="tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button></div>
      <form onSubmit={submitAuth} className="stack">
        {mode === "register" && <label>Full name<input required value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Your name" /></label>}
        <label>Email address<input required type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label>
        <label>Password<input required minLength="8" type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" /></label>
        <button className="primary" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Login" : "Create account"}</button>
      </form>
      {message && <p className="notice">{message}</p>}
      <p className="small muted">Student project demo. Use test data only.</p>
    </section>
  </main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="logo small-logo">₹</span><span>SpendWise<small>PERSONAL FINANCE</small></span></div>
      <div className="side-label">WORKSPACE</div><div className="side-link selected">▦ &nbsp; Overview</div><div className="side-link">↗ &nbsp; Expenses</div><div className="side-link">◷ &nbsp; Monthly budget</div>
      <div className="sidebar-bottom"><div className="avatar">{(user?.name || "U").slice(0, 1).toUpperCase()}</div><div className="user-info"><b>{user?.name}</b><small>{user?.email}</small></div><button className="logout" onClick={logout} title="Log out">↪</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><p className="eyebrow">YOUR FINANCIAL OVERVIEW</p><h1>Dashboard</h1><p className="muted">A clear picture of where your money goes.</p></div><label className="month-picker">Month<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label></header>
      {message && <div className="notice" role="status">{message}<button onClick={() => setMessage("")}>×</button></div>}
      <section className="stats">
        <article className="stat-card"><span className="stat-icon purple">₹</span><p>Total spent</p><h2>{money(summary.total)}</h2><small>Selected month</small></article>
        <article className="stat-card"><span className="stat-icon green">◎</span><p>Monthly budget</p><h2>{money(summary.budget)}</h2><small>Planned spending limit</small></article>
        <article className="stat-card"><span className="stat-icon orange">↗</span><p>Budget remaining</p><h2>{money(summary.remaining)}</h2><small>{summary.budget && summary.remaining < 0 ? "Amount over budget" : "Available to spend"}</small></article>
      </section>
      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading"><div><h2>Add an expense</h2><p className="muted">Record a purchase or payment.</p></div><span className="panel-symbol">＋</span></div>
          <form className="form-grid" onSubmit={addExpense}>
            <label>Amount (₹)<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></label>
            <label>Date<input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label>Category<select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="">Choose category</option>{categories.map(c => <option key={c._id || c.name} value={c.name}>{c.name}</option>)}</select></label>
            <label>Payment mode<select value={form.paymentMode} onChange={e => setForm({ ...form, paymentMode: e.target.value })}>{["UPI", "Cash", "Card", "Bank Transfer", "Other"].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="full">Description<input maxLength="200" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Lunch with friends" /></label>
            <button className="primary full" type="submit">＋ Save expense</button>
          </form>
        </article>
        <article className="panel budget-panel">
          <div className="panel-heading"><div><h2>Monthly budget</h2><p className="muted">Plan ahead and stay in control.</p></div><span className="panel-symbol">◷</span></div>
          <form onSubmit={saveBudget} className="budget-form"><label>Budget limit (₹)<input type="number" min="0.01" step="0.01" required value={budgetInput} onChange={e => setBudgetInput(e.target.value)} placeholder="Enter monthly budget" /></label><button className="secondary">Save budget</button></form>
          <div className="progress-label"><span>Budget used</span><b>{summary.usagePercent}%</b></div>
          <div className="progress"><div style={{ width: `${Math.min(100, summary.usagePercent)}%` }} /></div>
          <p className={`budget-message ${summary.budget && summary.usagePercent >= 80 ? "warning" : ""}`}>{budgetStatus}</p>
          {summary.budget > 0 && <p className="muted small">{money(summary.total)} spent of {money(summary.budget)}</p>}
        </article>
      </section>
      <section className="content-grid lower-grid">
        <article className="panel">
          <div className="panel-heading"><div><h2>Expense history</h2><p className="muted">Search and review your records.</p></div><span className="count-pill">{expenses.length} shown</span></div>
          <div className="filters">
            <label>From<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label>
            <label>To<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label>
            <label>Category<select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map(c => <option key={c._id || c.name}>{c.name}</option>)}</select></label>
            <label>Payment<select value={filters.paymentMode} onChange={e => setFilters({ ...filters, paymentMode: e.target.value })}><option value="">All modes</option>{["UPI", "Cash", "Card", "Bank Transfer", "Other"].map(x => <option key={x}>{x}</option>)}</select></label>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Expense</th><th>Date</th><th>Payment</th><th className="right">Amount</th><th></th></tr></thead><tbody>
            {expenses.map(item => <tr key={item._id}><td><div className="expense-name">{item.description || item.category}</div><small className="muted">{item.category}</small></td><td>{item.date}</td><td><span className="payment-tag">{item.paymentMode}</span></td><td className="right amount">{money(item.amount)}</td><td><button className="delete" onClick={() => deleteExpense(item._id)} aria-label="Delete expense">×</button></td></tr>)}
            {!expenses.length && <tr><td colSpan="5" className="empty">No expenses found. Add your first expense above.</td></tr>}
          </tbody></table></div>
        </article>
        <article className="panel category-panel">
          <div className="panel-heading"><div><h2>Spending by category</h2><p className="muted">Your monthly breakdown.</p></div></div>
          {summary.categories.length ? summary.categories.map((c, i) => <div className="category-row" key={c._id || c._id === 0 ? c._id : c._id || c._id}><div className="category-line"><span><i className={`dot dot-${i % 5}`} />{c._id}</span><b>{money(c.total)}</b></div><div className="mini-progress"><div style={{ width: `${summary.total ? c.total / summary.total * 100 : 0}%` }} /></div><small className="muted">{summary.total ? Math.round(c.total / summary.total * 100) : 0}% of spending</small></div>) : <p className="empty">Your category summary will appear after you add expenses.</p>}
          <div className="category-add"><h3>Manage categories</h3><form onSubmit={addCategory}><input value={newCategory} maxLength="40" onChange={e => setNewCategory(e.target.value)} placeholder="New category name" required /><button className="secondary">Add</button></form><div className="category-chips">{categories.map(c => <span key={c._id || c.name}>{c.name}</span>)}</div></div>
        </article>
      </section>
      <footer>SpendWise · Personal Expense Tracker · Full Stack Development Project</footer>
    </main>
  </div>;
}
