import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabaseConfigError } from '../lib/supabase'

export default function LoginPage() {
  const { signIn, session, role, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="card auth-card">
          <div className="brand">ICON</div>
          <p className="muted">Loading login…</p>
        </div>
      </div>
    )
  }

  if (session && role === 'optician') return <Navigate to="/optician" replace />
  if (session && role === 'office') return <Navigate to="/office" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div className="brand">ICON</div>
        <h1>Order Portal</h1>
        <p className="muted">Sign in as Optician or Aynai (office).</p>
        {supabaseConfigError ? <div className="alert">{supabaseConfigError}</div> : null}
        {session && !role ? (
          <div className="alert">Signed in, but no role found. Check profiles in Supabase.</div>
        ) : null}
        {error ? <div className="alert">{error}</div> : null}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="you@email.com"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
