export default function JoinSummary({ clubName, draft }) {
  const motivation = draft.motivation.trim()

  return (
    <aside className="summary-card" aria-labelledby="join-summary-title">
      <h3 id="join-summary-title">Поточна чернетка</h3>
      <dl>
        <dt>Клуб</dt>
        <dd>{clubName}</dd>
        <dt>Чому хочете приєднатися</dt>
        <dd>{motivation || 'Ще не вказано'}</dd>
        <dt>Годин на тиждень</dt>
        <dd>{draft.weeklyHours === '' ? 'Ще не вказано' : draft.weeklyHours}</dd>
        <dt>Нагадування про зустрічі</dt>
        <dd>
          <span className={`summary-badge ${draft.wantsReminders ? 'on' : 'off'}`}>
            {draft.wantsReminders ? 'Увімкнено' : 'Вимкнено'}
          </span>
        </dd>
      </dl>
      <p className="summary-note">Цей підсумок не підтверджує приєднання.</p>
    </aside>
  )
}