import { Route, Routes } from 'react-router'
import AppLayout from './components/layout/AppLayout.jsx'
import RequestsLayout from './components/layout/RequestsLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import CatalogContainer from './pages/CatalogContainer.jsx'
import ClubDetailsPage from './pages/ClubDetailsPage.jsx'
import RequestsPage from './pages/RequestsPage.jsx'
import RequestCreatePage from './pages/RequestCreatePage.jsx'
import RequestEditPage from './pages/RequestEditPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import { clubs } from './data/clubs.js'
import { requests } from './data/requests.js'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout clubs={clubs} />}>
        <Route index element={<HomePage />} />

        <Route path="clubs">
          <Route index element={<CatalogContainer clubs={clubs} />} />
          <Route
            path=":clubId"
            element={<ClubDetailsPage clubs={clubs} />}
          />
        </Route>

        <Route path="requests" element={<RequestsLayout />}>
          <Route
            index
            element={<RequestsPage requests={requests} clubs={clubs} />}
          />
          <Route path="new" element={<RequestCreatePage clubs={clubs} />} />
          <Route
            path=":requestId/edit"
            element={<RequestEditPage requests={requests} clubs={clubs} />}
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}