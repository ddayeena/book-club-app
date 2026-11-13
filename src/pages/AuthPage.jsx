import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import FormField from '../components/ui/FormField.jsx'
import useAuth from '../hooks/useAuth.js'
import { validateLogin, validateRegistration } from '../domain/authValidation.js'

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const { user, login, register } = useAuth()
  const location = useLocation()
  const from = location.state?.from
  const target = from ? `${from.pathname}${from.search ?? ''}` : '/'

  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState(false)

  if (user) return <Navigate to={target} replace />

  const validation = isRegister ? validateRegistration(values) : validateLogin(values)
  const errors = attempted ? { ...validation.errors, ...serverErrors } : {}

  function handleChange(field, value) {
    setValues((previous) => ({ ...previous, [field]: value }))
    setServerErrors({})
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return
    setAttempted(true)
    setFormError('')
    setServerErrors({})

    if (!validation.ok) {
      const firstField = ['name', 'email', 'password'].find((field) => validation.errors[field])
      if (firstField) event.currentTarget.elements.namedItem(firstField)?.focus()
      return
    }

    setIsSubmitting(true)
    const result = await (isRegister ? register(values) : login(values))
    if (result.ok && result.confirmationRequired) {
      setConfirmation(true)
      setValues((previous) => ({ ...previous, password: '' }))
      setAttempted(false)
      setIsSubmitting(false)
    }
    // Після успіху користувач зʼявляється в контексті, і сторінка перенаправляє сама.
    if (!result.ok) {
      setServerErrors(result.errors ?? {})
      setFormError(result.errors ? '' : result.message)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside" aria-hidden="true">
        <p className="auth-quote">
          Книга стає ближчою,
          <br />
          коли її читають <em>разом</em>.
        </p>
        <div className="auth-spines">
          <i /><i /><i /><i /><i />
        </div>
      </aside>

      <div className="auth-panel">
        <PageHeading title={isRegister ? 'Створити обліковий запис' : 'Вхід'} />
        <p className="page-lead">
          {from
            ? 'Увійдіть, щоб продовжити.'
            : isRegister
              ? 'Реєстрація потрібна, щоб подавати заявки й створювати клуби.'
              : 'Раді бачити вас знову.'}
        </p>

        <form noValidate onSubmit={handleSubmit} aria-label={isRegister ? 'Форма реєстрації' : 'Форма входу'}>
          {confirmation && <p role="status" className="flash">Перевірте пошту для підтвердження реєстрації, потім увійдіть. Якщо лист не надійшов, перевірте спам.</p>}
          {formError && <p role="alert" className="form-alert">{formError}</p>}

          {isRegister && (
            <FormField id="auth-name" label="Імʼя" error={errors.name}>
              <input
                id="auth-name"
                name="name"
                type="text"
                autoComplete="name"
                value={values.name}
                onChange={(event) => handleChange('name', event.target.value)}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'auth-name-error' : undefined}
              />
            </FormField>
          )}

          <FormField id="auth-email" label="Пошта" error={errors.email}>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => handleChange('email', event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'auth-email-error' : undefined}
            />
          </FormField>

          <FormField
            id="auth-password"
            label="Пароль"
            hint={isRegister ? 'Щонайменше 8 символів, літера й цифра.' : undefined}
            error={errors.password}
          >
            <input
              id="auth-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={values.password}
              onChange={(event) => handleChange('password', event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                isRegister
                  ? `auth-password-hint${errors.password ? ' auth-password-error' : ''}`
                  : errors.password ? 'auth-password-error' : undefined
              }
            />
          </FormField>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Показати пароль
          </label>

          <div className="form-actions">
            <AppButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Зачекайте…' : isRegister ? 'Зареєструватися' : 'Увійти'}
            </AppButton>
          </div>
        </form>

        <p className="auth-switch">
          {isRegister ? (
            <>Вже є обліковий запис? <Link to="/login" state={location.state}>Увійти</Link></>
          ) : (
            <>Ще немає облікового запису? <Link to="/register" state={location.state}>Зареєструватися</Link></>
          )}
        </p>

        <p className="field-hint">
          Для входу використовуйте обліковий запис із підтвердженою поштою. Старі локальні облікові записи не перенесено.
        </p>
      </div>
    </div>
  )
}
