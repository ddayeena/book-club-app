import { useState } from 'react'
import AppButton from '../ui/AppButton.jsx'

export default function PollOptions({ poll, busy, onVote }) {
  const [choice, setChoice] = useState(poll.myOptionId ?? '')
  return <form className="book-editor" aria-label="Ваш голос" onSubmit={(e) => { e.preventDefault(); if (!busy && choice) void onVote(choice) }}>
    <fieldset disabled={busy} className="poll-options">
      <legend>{poll.myOptionId ? 'Змінити свій вибір' : 'Оберіть наступну книгу'}</legend>
      {poll.options.map((option) => <label key={option.id} className="checkbox-field"><input type="radio" name="vote"
        value={option.id} checked={choice === option.id} onChange={() => setChoice(option.id)} />{option.title} — {option.author || 'Автор не вказаний'}</label>)}
    </fieldset>
    <AppButton type="submit" disabled={busy || !choice || choice === poll.myOptionId}>{busy ? 'Збереження…' : poll.myOptionId ? 'Змінити голос' : 'Проголосувати'}</AppButton>
    <p className="field-hint">Один голос на учасника. До завершення строку вибір можна змінювати.</p>
  </form>
}
