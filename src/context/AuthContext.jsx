import { createContext, useContext, useState, useCallback } from 'react'
import { DB, hashPassword, uid, createSampleData } from '../utils/helpers'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return DB.getSession() } catch { return null }
  })

  // ── Sign Up (email/password) ───────────────────────────────────────────────
  const signUp = useCallback(({ name, email, password }) => {
    try {
      const users = DB.getUsers()
      if (users[email]) return { error: 'This email is already registered. Please sign in.' }
      const userId = uid()
      users[email] = { id:userId, name, email, hash:hashPassword(password), provider:'local', createdAt:Date.now() }
      DB.saveUsers(users)
      DB.saveData(userId, createSampleData())
      DB.saveSettings(userId, { currency:'INR' })
      const sess = { userId, name, email, provider:'local' }
      DB.saveSession(sess)
      setSession(sess)
      return { ok:true }
    } catch { return { error:'Sign up failed. Please try again.' } }
  }, [])

  // ── Sign In (email/password) ───────────────────────────────────────────────
  const signIn = useCallback(({ email, password }) => {
    try {
      const users = DB.getUsers()
      const user  = users[email]
      if (!user || user.hash !== hashPassword(password)) {
        return { error:'Incorrect email or password.' }
      }
      const sess = { userId:user.id, name:user.name, email:user.email, picture:user.picture||null, provider:'local' }
      DB.saveSession(sess)
      setSession(sess)
      return { ok:true }
    } catch { return { error:'Sign in failed. Please try again.' } }
  }, [])

  // ── Google Sign In / Sign Up ───────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    // This uses Google Identity Services popup flow
    return new Promise((resolve) => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

      if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
        resolve({ error: 'Google Sign-In is not configured yet. Please add your VITE_GOOGLE_CLIENT_ID.' })
        return
      }

      // Load Google Identity Services script if not already loaded
      const initGoogleAuth = () => {
        window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              resolve({ error: 'Google sign-in was cancelled or failed.' })
              return
            }
            try {
              // Fetch user profile from Google
              const res     = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              })
              const profile = await res.json()

              const email   = profile.email
              const users   = DB.getUsers()

              let user = users[email]
              if (!user) {
                // Auto-register on first Google login
                const userId = uid()
                user = { id:userId, name:profile.name, email, picture:profile.picture, provider:'google', createdAt:Date.now() }
                users[email] = user
                DB.saveUsers(users)
                DB.saveData(userId, createSampleData())
                DB.saveSettings(userId, { currency:'INR' })
              } else {
                // Update picture in case it changed
                users[email] = { ...user, picture:profile.picture, provider:'google' }
                DB.saveUsers(users)
              }

              const sess = { userId:user.id, name:profile.name, email, picture:profile.picture, provider:'google' }
              DB.saveSession(sess)
              setSession(sess)
              resolve({ ok:true })
            } catch {
              resolve({ error:'Failed to fetch Google profile. Please try again.' })
            }
          },
        }).requestAccessToken()
      }

      if (window.google?.accounts) {
        initGoogleAuth()
      } else {
        // Dynamically load the Google Identity Services script
        const script = document.createElement('script')
        script.src   = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.onload  = initGoogleAuth
        script.onerror = () => resolve({ error:'Could not load Google Sign-In. Check your internet connection.' })
        document.head.appendChild(script)
      }
    })
  }, [])

  // ── Demo Login ────────────────────────────────────────────────────────────
  const signInDemo = useCallback(() => {
    try {
      const users     = DB.getUsers()
      const demoEmail = 'demo@wealthradar.in'
      if (!users[demoEmail]) {
        const userId = 'wr_demo_01'
        users[demoEmail] = { id:userId, name:'Demo User', email:demoEmail, hash:hashPassword('demo123'), provider:'local', createdAt:Date.now() }
        DB.saveUsers(users)
        DB.saveData(userId, createSampleData())
        DB.saveSettings(userId, { currency:'INR' })
      }
      const user = users[demoEmail]
      const sess = { userId:user.id, name:user.name, email:user.email, provider:'local' }
      DB.saveSession(sess)
      setSession(sess)
    } catch (e) { console.error('Demo login error:', e) }
  }, [])

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    try { DB.clearSession() } catch {}
    setSession(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, signUp, signIn, signInWithGoogle, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
