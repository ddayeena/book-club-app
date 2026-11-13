import { useEffect } from 'react'
import { pollStatuses } from '../../domain/pollValidation.js'

function remainingPollTime(poll) {
  return new Date(poll.endsAt).getTime() - new Date(poll.serverNow).getTime() - Math.max(0, Date.now() - poll.receivedAt)
}
export default function PollStatus({ poll, onDeadline }) {
  useEffect(() => {
    if (poll.status !== 'open' || !onDeadline) return
    // Use the server clock offset, then reload authoritative status at the deadline.
    const timer = setTimeout(onDeadline, Math.max(0, Math.min(remainingPollTime(poll) + 50, 2147483647)))
    return () => clearTimeout(timer)
  }, [poll, onDeadline])
  return <div className="poll-status"><span className="book-status">{pollStatuses[poll.status]}</span>
    <p>Завершення: <time dateTime={poll.endsAt}>{new Date(poll.endsAt).toLocaleString('uk-UA')}</time></p>
    {poll.status === 'closed' && <p>Прийом голосів завершено. Власник має зафіксувати результат або скасувати голосування.</p>}
    {poll.cancelReason === 'club_archived' && <p>Скасовано через архівування клубу.</p>}
  </div>
}
