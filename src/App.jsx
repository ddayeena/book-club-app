import { Suspense } from 'react'
import { lazyPage } from './routes/lazyPage.js'
import PageLoading from './components/layout/PageLoading.jsx'
import ErrorBoundary from './components/layout/ErrorBoundary.jsx'
import { Route, Routes } from 'react-router'
import AppLayout from './components/layout/AppLayout.jsx'
import RequestsLayout from './components/layout/RequestsLayout.jsx'
import RequireAuth from './components/auth/RequireAuth.jsx'
import HomePage from './pages/HomePage.jsx'
import ClubsListPage from './pages/ClubsListPage.jsx'
import ClubDetailsPage from './pages/ClubDetailsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ClubMembersPage from './pages/ClubMembersPage.jsx'
import ClubRequestsPage from './pages/ClubRequestsPage.jsx'
import RequireAdmin from './components/auth/RequireAdmin.jsx'
import SessionLayout from './components/layout/SessionLayout.jsx'

const AdminLayout = lazyPage(() => import('./routes/adminPages.jsx'), 'AdminLayout')
const AdminDashboardPage = lazyPage(() => import('./routes/adminPages.jsx'), 'AdminDashboardPage')
const AdminUsersPage = lazyPage(() => import('./routes/adminPages.jsx'), 'AdminUsersPage')
const AdminClubsPage = lazyPage(() => import('./routes/adminPages.jsx'), 'AdminClubsPage')
const AdminClubDetailsPage = lazyPage(() => import('./routes/adminPages.jsx'), 'AdminClubDetailsPage')
const AdminUserDetailsPage = lazyPage(() => import('./routes/adminPages.jsx'), 'AdminUserDetailsPage')
const ClubMeetingsPage = lazyPage(() => import('./routes/meetingPages.jsx'), 'ClubMeetingsPage')
const MeetingDetailsPage = lazyPage(() => import('./routes/meetingPages.jsx'), 'MeetingDetailsPage')
const MeetingEditorPage = lazyPage(() => import('./routes/meetingPages.jsx'), 'MeetingEditorPage')
const ClubDiscussionsPage = lazyPage(() => import('./routes/discussionPages.jsx'), 'ClubDiscussionsPage')
const DiscussionDetailsPage = lazyPage(() => import('./routes/discussionPages.jsx'), 'DiscussionDetailsPage')
const DiscussionEditorPage = lazyPage(() => import('./routes/discussionPages.jsx'), 'DiscussionEditorPage')
const RequestsPage = lazyPage(() => import('./routes/requestPages.jsx'), 'RequestsPage')
const RequestCreatePage = lazyPage(() => import('./routes/requestPages.jsx'), 'RequestCreatePage')
const RequestDetailsPage = lazyPage(() => import('./routes/requestPages.jsx'), 'RequestDetailsPage')
const RequestEditPage = lazyPage(() => import('./routes/requestPages.jsx'), 'RequestEditPage')
const ProfilePage = lazyPage(() => import('./routes/personalPages.jsx'), 'ProfilePage')
const MyClubsPage = lazyPage(() => import('./routes/personalPages.jsx'), 'MyClubsPage')
const NotificationsPage = lazyPage(() => import('./routes/personalPages.jsx'), 'NotificationsPage')
const ClubBooksPage = lazyPage(() => import('./routes/bookPages.jsx'), 'ClubBooksPage')
const ClubPollsPage = lazyPage(() => import('./routes/bookPages.jsx'), 'ClubPollsPage')
const ClubPollPage = lazyPage(() => import('./routes/bookPages.jsx'), 'ClubPollPage')
const ClubEditorPage = lazyPage(() => import('./routes/editorPages.jsx'), 'ClubEditorPage')
const AuthPage = lazyPage(() => import('./routes/editorPages.jsx'), 'AuthPage')
const LogoutPage = lazyPage(() => import('./routes/editorPages.jsx'), 'LogoutPage')

export default function App() {
  return (
    <Routes>
      <Route element={<SessionLayout />}>
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
            <Route path=":clubId/members" element={<ClubMembersPage />} />
            <Route path=":clubId/requests" element={<ClubRequestsPage />} />
            <Route path=":clubId/polls" element={<ClubPollsPage />} />
            <Route path=":clubId/polls/:pollId" element={<ClubPollPage />} />
            <Route path=":clubId/meetings" element={<ClubMeetingsPage />} />
            <Route path=":clubId/meetings/new" element={<MeetingEditorPage />} />
            <Route path=":clubId/meetings/:meetingId" element={<MeetingDetailsPage />} />
            <Route path=":clubId/meetings/:meetingId/edit" element={<MeetingEditorPage />} />
            <Route path=":clubId/discussions" element={<ClubDiscussionsPage />} />
            <Route path=":clubId/discussions/new" element={<DiscussionEditorPage />} />
            <Route path=":clubId/discussions/:discussionId" element={<DiscussionDetailsPage />} />
            <Route path=":clubId/discussions/:discussionId/edit" element={<DiscussionEditorPage />} />
          </Route>
          <Route path=":clubId" element={<ClubDetailsPage />} />
          <Route path=":clubId/books" element={<ClubBooksPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="my-clubs" element={<MyClubsPage />} />
          <Route path="requests" element={<RequestsLayout />}>
            <Route index element={<RequestsPage />} />
            <Route path="new" element={<RequestCreatePage />} />
            <Route path=":requestId" element={<RequestDetailsPage />} />
            <Route path=":requestId/edit" element={<RequestEditPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route element={<RequireAdmin />}>
        <Route path="admin" element={<ErrorBoundary resetKey="admin"><Suspense fallback={<PageLoading />}><AdminLayout /></Suspense></ErrorBoundary>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:userId" element={<AdminUserDetailsPage />} />
          <Route path="clubs" element={<AdminClubsPage />} />
          <Route path="clubs/:clubId" element={<AdminClubDetailsPage />} />
        </Route>
      </Route>
      </Route>
    </Routes>
  )
}
