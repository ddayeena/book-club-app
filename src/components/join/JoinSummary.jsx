export default function JoinSummary({ clubName, draft }) {
    const motivation = draft.motivation.trim()
  
    return (
      <aside aria-labelledby="join-summary-title">
        <h3 id="join-summary-title">Поточна чернетка</h3>
        <dl>
          <dt>Клуб</dt>
          <dd>{clubName}</dd>
          <dt>Чому хочете приєднатися</dt>
          <dd>{motivation || 'Ще не вказано'}</dd>
          <dt>Нагадування про зустрічі</dt>
          <dd>{draft.wantsReminders ? 'Увімкнено' : 'Вимкнено'}</dd>
        </dl>
        <p>Цей підсумок не підтверджує приєднання.</p>
      </aside>
    )
  }