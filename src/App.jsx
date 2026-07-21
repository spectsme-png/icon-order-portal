import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import OpticianPage from './pages/OpticianPage'
import OfficePage from './pages/OfficePage'
import PrintStickersPage from './pages/PrintStickersPage'
import PrintWarrantyPage from './pages/PrintWarrantyPage'

function RequireRole({ role, children }) {
  const { loading, session, role: userRole } = useAuth()
  if (loading) return <div className="page muted">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (userRole !== role) {
    if (userRole === 'office') return <Navigate to="/office" replace />
    if (userRole === 'optician') return <Navigate to="/optician" replace />
    return (
      <div className="page">
        <div className="alert">
          Your account has no role yet. Ask Aynai to set your profile role in Supabase
          (`optician` or `office`).
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/optician"
          element={
            <RequireRole role="optician">
              <OpticianPage />
            </RequireRole>
          }
        />
        <Route
          path="/office"
          element={
            <RequireRole role="office">
              <OfficePage />
            </RequireRole>
          }
        />
        <Route
          path="/office/print/stickers/:id"
          element={
            <RequireRole role="office">
              <PrintStickersPage />
            </RequireRole>
          }
        />
        <Route
          path="/office/print/warranty/:id"
          element={
            <RequireRole role="office">
              <PrintWarrantyPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
