import { useState } from 'react'
import { pollLeaders } from '../../domain/pollValidation.js'
import AppButton from '../ui/AppButton.jsx'

export default function PollFinalization({ poll, busy, onFinalize }) {
  const leaders = pollLeaders(poll.options)
  const [choice, setChoice] = useState(leaders.length === 1 ? leaders[0].id : '')
  return <section className="book-editor" aria-label="Фіксація результату">
    <h2>Оберіть наступну книгу</h2>
    <p>{poll.totalVotes === 0 ? 'Голосів немає. Оберіть будь-який варіант.' : leaders.length > 1 ? 'Нічия. Оберіть одну з книг-лідерів.' : 'Перемогла книга з найбільшою кількістю голосів.'}</p>
    <fieldset disabled={busy} className="poll-options"><legend>Переможець</legend>
      {leaders.map((o) => <label className="checkbox-field" key={o.id}><input type="radio" name="winner"
        checked={choice === o.id} onChange={() => setChoice(o.id)} />{o.title}</label>)}
    </fieldset>
    <AppButton disabled={busy || !choice} onClick={() => void onFinalize(choice)}>Зафіксувати переможця</AppButton>
    <p className="field-hint">Книга залишиться запланованою. Почати читання можна окремо на книжковій полиці.</p>
  </section>
}
