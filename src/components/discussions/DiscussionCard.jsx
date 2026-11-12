import { Link } from 'react-router'
export default function DiscussionCard({ topic, search = '' }) {
  return <article className="discussion-card"><h2><Link to={`/clubs/${topic.club_id}/discussions/${topic.id}${search}`}>{topic.title}</Link></h2>
    <p className="field-hint">{topic.author_name} · <time dateTime={topic.created_at}>{new Date(topic.created_at).toLocaleString('uk-UA')}</time></p>
    {topic.book_title && <p className="meta-tag">{topic.book_title}</p>}<p>Коментарів: {topic.comments_count}</p>
  </article>
}
