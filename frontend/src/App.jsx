import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/useAuth'
import Layout from './components/Layout'
import { Loading } from './components/UI'
import Administration from './pages/Administration'
import Dashboard from './pages/Dashboard'
import Health from './pages/Health'
import Login from './pages/Login'
import Rates from './pages/Rates'
import Records from './pages/Records'

function PrivateRoute() {
  const { session, loading } = useAuth()
  if (loading)
    return (
      <div className="p-10">
        <Loading />
      </div>
    )
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

function TenantRoute() {
  const { tenant } = useAuth()
  return tenant ? <Outlet /> : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/health" element={<Health />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route element={<TenantRoute />}>
                <Route
                  path="branches"
                  element={<Records key="branches" kind="branches" />}
                />
                <Route
                  path="rooms"
                  element={<Records key="rooms" kind="rooms" />}
                />
                <Route path="rates" element={<Rates />} />
                <Route path="administration" element={<Administration />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
