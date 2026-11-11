import { votePercent } from '../../domain/pollValidation.js'

export default function PollResults({ poll }) {
  return <section className="poll-results" aria-label="Результати голосування">
    <h2>Результати</h2><p>Усього голосів: {poll.totalVotes}</p>
    <ul className="poll-result-list">{poll.options.map((option) => <li key={option.id}>
      <div><strong>{option.title}</strong>{poll.winnerOptionId === option.id && <span className="book-status"> Переможець</span>}</div>
      <p>{option.author || 'Автор не вказаний'} · {option.votes} голосів · {votePercent(option.votes, poll.totalVotes)}%</p>
      <progress aria-label={`Голоси за ${option.title}`} value={option.votes} max={Math.max(1, poll.totalVotes)} />
    </li>)}</ul>
    <p className="field-hint">Показано лише підсумки, без імен виборців.</p>
  </section>
}
