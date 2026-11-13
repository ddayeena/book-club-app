import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import JoinPage from './JoinPage.jsx'
import { testClub, validInput, savedRequest } from '../test/fixtures.js'
import { deferred } from '../test/deferred.js'

function renderEditor(onSave) {
  return render(
    <JoinPage
      title="Нова заявка"
      club={testClub}
      onSave={onSave}
      onCancel={vi.fn()}
      submitLabel="Створити заявку"
    />,
  )
}

async function fillValidForm(user) {
  await user.type(
    screen.getByRole('textbox', { name: /Чому хочете приєднатися/ }),
    validInput.motivation,
  )
  const hours = screen.getByRole('spinbutton', { name: /Годин на тиждень/ })
  await user.clear(hours)
  await user.type(hours, '2')
  await user.selectOptions(
    screen.getByRole('combobox', { name: /Досвід читання/ }),
    'regular',
  )
  await user.selectOptions(
    screen.getByRole('combobox', { name: /Бажаний формат участі/ }),
    'online',
  )
  await user.type(
    screen.getByRole('textbox', { name: /Контактна пошта/ }),
    validInput.contactEmail,
  )
  await user.click(screen.getByRole('checkbox', { name: /Надсилати нагадування/ }))
}

test('не зберігає порожню мотивацію та пояснює помилку', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  renderEditor(onSave)

  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  const motivation = screen.getByRole('textbox', { name: /Чому хочете приєднатися/ })
  expect(motivation).toHaveAttribute('aria-invalid', 'true')
  expect(motivation).toHaveFocus()
  expect(screen.getByText('Укажіть, чому хочете приєднатися.')).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()
})

test('пояснює некоректну пошту й не викликає збереження', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  renderEditor(onSave)
  await user.type(
    screen.getByRole('textbox', { name: /Чому хочете приєднатися/ }),
    validInput.motivation,
  )
  await user.type(screen.getByRole('textbox', { name: /Контактна пошта/ }), 'не-пошта')

  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  expect(screen.getByRole('textbox', { name: /Контактна пошта/ }))
    .toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText(/Вкажіть коректну адресу пошти/)).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()
})

test('для понад чотирьох годин вимагає нагадування', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  renderEditor(onSave)
  await user.type(
    screen.getByRole('textbox', { name: /Чому хочете приєднатися/ }),
    validInput.motivation,
  )
  const hours = screen.getByRole('spinbutton', { name: /Годин на тиждень/ })
  await user.clear(hours)
  await user.type(hours, '5')

  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  expect(screen.getByRole('checkbox', { name: /Надсилати нагадування/ }))
    .toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText(/увімкніть нагадування про зустрічі/)).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()
})

test('передає нормалізовані поля й блокує повтор до відповіді', async () => {
  const user = userEvent.setup()
  const pending = deferred()
  const onSave = vi.fn().mockReturnValue(pending.promise)
  renderEditor(onSave)
  await fillValidForm(user)

  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  const submit = screen.getByRole('button', { name: 'Збереження…' })
  expect(submit).toBeDisabled()
  expect(screen.getByRole('textbox', { name: /Чому хочете приєднатися/ })).toBeDisabled()
  await user.click(submit)
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave).toHaveBeenCalledWith(validInput)

  await act(async () => {
    pending.resolve({ ok: true, record: savedRequest })
    await pending.promise
  })

  expect(screen.getByRole('button', { name: 'Створити заявку' })).toBeEnabled()
})

test('після відмови зберігає введення й дозволяє свідомий повтор', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
    .mockResolvedValueOnce({ ok: false, message: 'Сервіс тимчасово недоступний.' })
    .mockResolvedValueOnce({ ok: true, record: savedRequest })
  renderEditor(onSave)
  await fillValidForm(user)

  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Сервіс тимчасово недоступний.',
  )
  expect(screen.getByRole('textbox', { name: /Чому хочете приєднатися/ }))
    .toHaveValue(validInput.motivation)
  expect(screen.getByRole('spinbutton', { name: /Годин на тиждень/ })).toHaveValue(2)
  expect(screen.getByRole('combobox', { name: /Досвід читання/ })).toHaveValue('regular')
  expect(screen.getByRole('combobox', { name: /Бажаний формат участі/ })).toHaveValue('online')
  expect(screen.getByRole('textbox', { name: /Контактна пошта/ }))
    .toHaveValue(validInput.contactEmail)
  expect(screen.getByRole('checkbox', { name: /Надсилати нагадування/ })).toBeChecked()

  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Створити заявку' })).toBeEnabled()
  })
  expect(onSave).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})