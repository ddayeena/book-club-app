import { useParams } from 'react-router'
import useAuth from '../../hooks/useAuth.js'
import useClubs from '../../hooks/useClubs.js'
import NotFoundPage from '../../pages/NotFoundPage.jsx'

export default function DiscussionScope({ children }) {
  const { clubId, discussionId } = useParams(), { user } = useAuth(), { clubs } = useClubs()
  const club = clubs.find((c) => c.id === clubId)
  if (!club || !user || !(club.ownerId === user.id || club.isMember || user.role === 'admin')) return <NotFoundPage title="Обговорення недоступні" />
  return <div key={`${user.id}:${clubId}:${discussionId ?? 'list'}`}>{children(club, user, discussionId)}</div>
}
