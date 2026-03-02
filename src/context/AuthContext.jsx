import { createContext, useContext, useState, useCallback } from 'react'
import { DB, hashPassword, uid, createSampleData } from '../utils/helpers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return DB.getSession() } catch { return null }
  })

  // ── Sign Up ───────────────────────────────────────────────────────────────
  const signUp = useCallback(({ name, email, password }) => {
    try {
      const users = DB.getUsers()
      if (users[email]) return { error: 'This email is already registered.' }
      const userId = uid()
      users[email] = {
        id: userId, name, email,
        hash: hashPassword(password),
        provider: 'local',
        createdAt: Date.now(),
      }
      DB.saveUsers(users)
      DB.saveData(userId, createSampleData())
      DB.saveSettings(userId, { currency: 'INR' })
      const sess = { userId, name, email, provider: 'local' }
      DB.saveSession(sess)
      setSession(sess)
      return { ok: true }
    } catch (e) {
      return { error: 'Sign up failed. Please try again.' }
    }
  }, [])

  // ── Sign In ───────────────────────────────────────────────────────────────
  const signIn = useCallback(({ email, password }) => {
    try {
      const users = DB.getUsers()
      const user  = users[email]
      if (!user || user.hash !== hashPassword(password)) {
        return { error: 'Invalid email or password.' }
      }
      const sess = { userId: user.id, name: user.name, email: user.email, provider: 'local' }
      DB.saveSession(sess)
      setSession(sess)
      return { ok: true }
    } catch (e) {
      return { error: 'Sign in failed. Please try again.' }
    }
  }, [])

  // ── Demo Login ────────────────────────────────────────────────────────────
  const signInDemo = useCallback(() => {
    try {
      const users     = DB.getUsers()
      const demoEmail = 'demo@wealthradar.in'
      if (!users[demoEmail]) {
        const userId = 'wr_demo_01'
        users[demoEmail] = {
          id: userId, name: 'Demo User',
          email: demoEmail,
          hash: hashPassword('demo123'),
          provider: 'local',
          createdAt: Date.now(),
        }
        DB.saveUsers(users)
        DB.saveData(userId, createSampleData())
        DB.saveSettings(userId, { currency: 'INR' })
      }
      const user = users[demoEmail]
      const sess = { userId: user.id, name: user.name, email: user.email, provider: 'local' }
      DB.saveSession(sess)
      setSession(sess)
    } catch (e) {
      console.error('Demo login error:', e)
    }
  }, [])

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    try { DB.clearSession() } catch {}
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, signUp, signIn, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
