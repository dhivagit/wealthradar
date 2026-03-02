import { createContext, useContext, useState, useCallback } from 'react'
import { DB, hashPassword, uid, createSampleData } from '../utils/helpers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => DB.getSession())

  // ── Local sign-up ─────────────────────────────────────────────────────────
  const signUp = useCallback(({ name, email, password }) => {
    const users = DB.getUsers()
    if (users[email]) return { error: 'Email already registered.' }

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
  }, [])

  // ── Local sign-in ─────────────────────────────────────────────────────────
  const signIn = useCallback(({ email, password }) => {
    const users = DB.getUsers()
    const user  = users[email]
    if (!user || user.hash !== hashPassword(password)) {
      return { error: 'Invalid email or password.' }
    }
    const sess = { userId: user.id, name: user.name, email: user.email, provider: 'local' }
    DB.saveSession(sess)
    setSession(sess)
    return { ok: true }
  }, [])

  // ── Google SSO sign-in ────────────────────────────────────────────────────
  // credentialResponse = object returned by @react-oauth/google useGoogleLogin / GoogleLogin
  const signInWithGoogle = useCallback((profile) => {
    // profile shape: { sub, name, email, picture }
    const users   = DB.getUsers()
    const email   = profile.email
    let user      = users[email]

    if (!user) {
      // Auto-register on first Google login
      const userId = uid()
      user = {
        id: userId, name: profile.name, email,
        picture: profile.picture,
        provider: 'google',
        googleSub: profile.sub,
        createdAt: Date.now(),
      }
      users[email] = user
      DB.saveUsers(users)
      DB.saveData(userId, createSampleData())
      DB.saveSettings(userId, { currency: 'INR' })
    }

    const sess = {
      userId:   user.id,
      name:     user.name,
      email:    user.email,
      picture:  user.picture || profile.picture,
      provider: 'google',
    }
    DB.saveSession(sess)
    setSession(sess)
    return { ok: true }
  }, [])

  // ── Demo login ────────────────────────────────────────────────────────────
  const signInDemo = useCallback(() => {
    const users     = DB.getUsers()
    const demoEmail = 'demo@wealthradar.in'
    if (!users[demoEmail]) {
      const userId = 'demo_user_01'
      users[demoEmail] = {
        id: userId, name: 'Arjun Sharma (Demo)',
        email: demoEmail, hash: hashPassword('demo123'),
        provider: 'local', createdAt: Date.now(),
      }
      DB.saveUsers(users)
      DB.saveData(userId, createSampleData())
      DB.saveSettings(userId, { currency: 'INR' })
    }
    const user = users[demoEmail]
    const sess = { userId: user.id, name: user.name, email: user.email, provider: 'local' }
    DB.saveSession(sess)
    setSession(sess)
  }, [])

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    DB.clearSession()
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, signUp, signIn, signInWithGoogle, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
