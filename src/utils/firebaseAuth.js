// Firebase Auth utility — activates when VITE_FIREBASE_API_KEY is set
let _auth = null
async function getAuth() {
  if (_auth) return _auth
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  if (!apiKey) return null
  try {
    const { initializeApp, getApps } = await import('firebase/app')
    const { getAuth: _getAuth } = await import('firebase/auth')
    const config = { apiKey, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID }
    const app = getApps().length ? getApps()[0] : initializeApp(config)
    _auth = _getAuth(app)
    return _auth
  } catch { return null }
}
export async function sendPasswordReset(email) {
  const auth = await getAuth()
  if (!auth) return { error: 'no_firebase' }
  try {
    const { sendPasswordResetEmail } = await import('firebase/auth')
    await sendPasswordResetEmail(auth, email)
    return { ok: true }
  } catch (err) {
    if (err.code === 'auth/user-not-found') return { error: 'not_found' }
    return { error: err.message || 'Failed to send email.' }
  }
}
export async function signInWithGoogleFirebase() {
  const auth = await getAuth()
  if (!auth) return { error: 'no_firebase' }
  try {
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth')
    const result = await signInWithPopup(auth, new GoogleAuthProvider())
    return { ok: true, user: { name: result.user.displayName, email: result.user.email, picture: result.user.photoURL, uid: result.user.uid } }
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') return { cancelled: true }
    return { error: err.message || 'Google sign-in failed.' }
  }
}
export const isFirebaseConfigured = () => Boolean(import.meta.env.VITE_FIREBASE_API_KEY)
