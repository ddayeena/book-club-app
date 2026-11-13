import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import useNavigate from '../hooks/useClubNavigate.js'
import useConfirmAction from '../hooks/useConfirmAction.jsx'
import PageHeading from '../components/ui/PageHeading.jsx'
import ClubForm from '../components/clubs/ClubForm.jsx'
import ClubPreview from '../components/clubs/ClubPreview.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { validateClub } from '../domain/clubValidation.js'
import NotFoundPage from './NotFoundPage.jsx'

const emptyDraft = {
  name: '',
  genre: '',
  description: '',
  format: 'online',
  language: 'Українська',
  meetingsPerMonth: '2',
}

const fieldOrder = Object.keys(emptyDraft)

function toDraft(club) {
  if (!club) return { ...emptyDraft }
  return {
    name: club.name,
    genre: club.genre,
    description: club.description,
    format: club.format,
    language: club.language,
    meetingsPerMonth: String(club.meetingsPerMonth),
  }
}

function ClubEditor({ club }) {
  const { ask, confirmation } = useConfirmAction()
  const navigate = useNavigate()
  const { clubs, createClub, updateClub, isMutating } = useClubs()
  const editing = Boolean(club)
  const initialValues = toDraft(club)
  const [draft, setDraft] = useState(() => toDraft(club))
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [operationError, setOperationError] = useState('')
  const alive = useRef(false)
  const submitting = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const validation = validateClub(draft)
  const errors = Object.fromEntries(
    Object.entries(validation.errors).filter(([field]) => attempted || touched[field]),
  )
  const isDirty = fieldOrder.some((field) => draft[field] !== initialValues[field])
  const genres = [...new Set(clubs.map((entry) => entry.genre))]
    .sort((a, b) => a.localeCompare(b, 'uk'))
  const backPath = editing ? `/clubs/${encodeURIComponent(club.id)}` : '/clubs'

  function handleChange(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setOperationError('')
  }

  function handleBlur(field) {
    setTouched((previous) => ({ ...previous, [field]: true }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting.current) return
    setAttempted(true)
    setOperationError('')

    if (!validation.ok) {
      const firstField = fieldOrder.find((field) => validation.errors[field])
      if (firstField) event.currentTarget.elements.namedItem(firstField)?.focus()
      return
    }

    submitting.current = true
    const result = await (editing ? updateClub(club.id, draft) : createClub(draft))
    submitting.current = false
    if (!alive.current) return
    if (!result.ok) {
      setOperationError(
        result.errors ? Object.values(result.errors).join(' ') : result.message,
      )
      return
    }

    navigate(`/clubs/${encodeURIComponent(result.club.id)}`, {
      replace: true,
      state: { notice: editing ? 'Зміни клубу збережено.' : 'Клуб створено.' },
    })
  }

  function handleCancel() {
    if (isDirty) ask({ title: 'Відкинути незбережені зміни?', description: 'Введені зміни клубу не буде збережено.', action: () => navigate(backPath) })
    else navigate(backPath)
  }

  return (
    <>
      <PageHeading title={editing ? `Редагування клубу: ${club.name}` : 'Новий клуб'} />
      {confirmation}
      <p className="page-lead">
        {editing
          ? 'Змініть дані клубу. Кількість учасників і власника змінити не можна.'
          : 'Ви станете власником клубу й першим учасником. Клуб зʼявиться в каталозі одразу.'}
      </p>
      <div className="editor-layout">
        <ClubForm
          idPrefix="club-form"
          draft={draft}
          errors={errors}
          operationError={operationError}
          genres={genres}
          onChange={handleChange}
          onBlur={handleBlur}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel={editing ? 'Зберегти зміни' : 'Створити клуб'}
          isSubmitting={isMutating}
        />
        <ClubPreview draft={{ ...draft, currentBook: club?.currentBook ?? '' }} />
      </div>
    </>
  )
}

export default function ClubEditorPage() {
  const { clubId } = useParams()
  const { user } = useAuth()
  const { clubs } = useClubs()
  const club = clubId ? clubs.find((entry) => entry.id === clubId) : null

  if (clubId && !club) return <NotFoundPage title="Клуб не знайдено" />
  if (club && (club.archivedAt || (club.ownerId !== user?.id && user?.role !== 'admin'))) {
    return (
      <NotFoundPage
        title="Немає доступу"
        message="Редагувати клуб може лише його власник."
      />
    )
  }

  return <ClubEditor key={club?.id ?? 'new'} club={club} />
}
