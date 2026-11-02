import { Route, Routes } from 'react-router'
import AppLayout from './components/layout/AppLayout.jsx'
import RequestsLayout from './components/layout/RequestsLayout.jsx'
import RequireAuth from './components/auth/RequireAuth.jsx'
import HomePage from './pages/HomePage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import LogoutPage from './pages/LogoutPage.jsx'
import ClubsListPage from './pages/ClubsListPage.jsx'
import ClubDetailsPage from './pages/ClubDetailsPage.jsx'
import ClubEditorPage from './pages/ClubEditorPage.jsx'
import RequestsPage from './pages/RequestsPage.jsx'
import RequestCreatePage from './pages/RequestCreatePage.jsx'
import RequestDetailsPage from './pages/RequestDetailsPage.jsx'
import RequestEditPage from './pages/RequestEditPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="logout" element={<LogoutPage />} />

        <Route path="clubs">
          <Route index element={<ClubsListPage />} />
          <Route element={<RequireAuth />}>
            <Route path="new" element={<ClubEditorPage />} />
            <Route path=":clubId/edit" element={<ClubEditorPage />} />
          </Route>
          <Route path=":clubId" element={<ClubDetailsPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="requests" element={<RequestsLayout />}>
            <Route index element={<RequestsPage />} />
            <Route path="new" element={<RequestCreatePage />} />
            <Route path=":requestId" element={<RequestDetailsPage />} />
            <Route path=":requestId/edit" element={<RequestEditPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
