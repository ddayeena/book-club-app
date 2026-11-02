
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App.jsx'
import { requestService } from './services/requestService.js'
import { ServiceError } from './services/ServiceError.js'
import { ownClub, savedRequest, validInput } from './test/fixtures.js'
import { customClubsKey } from './data/clubCatalog.js'
import { deferred } from './test/deferred.js'
import { signInDemo, signInOther, signOut } from './test/auth.js'

vi.mock('./services/requestService.js', () => ({
  requestService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

beforeEach(() => {
  localStorage.clear()
  signInDemo()
  for (const method of Object.values(requestService)) method.mockReset()
  requestService.getAll.mockResolvedValue([{ ...savedRequest }])
  requestService.getById.mockResolvedValue({ ...savedRequest })
  requestService.create.mockImplementation(async (input) => ({
    ...input, id: 'req-created', createdAt: '2026-10-11T08:00:00.000Z',
  }))
  requestService.update.mockImplementation(async (id, input) => ({
    ...input, id, createdAt: savedRequest.createdAt,
  }))
  requestService.delete.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderApp(path = '/requests') {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
  return user
}

async function fillRequestForm(user, input = validInput) {
  const motivation = await screen.findByRole('textbox', { name: /Чому хочете приєднатися/ })
  await user.type(motivation, input.motivation)
  const hours = screen.getByRole('spinbutton', { name: /Годин на тиждень/ })
  await user.clear(hours)
  await user.type(hours, String(input.weeklyHours))
  await user.selectOptions(
    screen.getByRole('combobox', { name: /Досвід читання/ }),
    input.experience,
  )
  await user.selectOptions(
    screen.getByRole('combobox', { name: /Бажаний формат участі/ }),
    input.participationFormat,
  )
  await user.type(
    screen.getByRole('textbox', { name: /Контактна пошта/ }),
    input.contactEmail,
  )
  await user.click(screen.getByRole('checkbox', { name: /Надсилати нагадування/ }))
}

test('показує завантаження до отримання колекції', async () => {
  const pending = deferred()
  requestService.getAll.mockReturnValueOnce(pending.promise)
  renderApp()

  expect(screen.getByText('Завантаження заявок…')).toBeInTheDocument()
  expect(screen.queryByText(savedRequest.motivation)).not.toBeInTheDocument()

  await act(async () => {
    pending.resolve([savedRequest])
    await pending.promise
  })

  expect(await screen.findByText(savedRequest.motivation)).toBeInTheDocument()
  expect(screen.queryByText('Завантаження заявок…')).not.toBeInTheDocument()
})

test('після відмови читання повторно завантажує дані', async () => {
  requestService.getAll
    .mockRejectedValueOnce(new ServiceError('Навчальна відмова читання.'))
    .mockResolvedValueOnce([savedRequest])
  const user = renderApp()

  expect(await screen.findByRole('alert')).toHaveTextContent('Навчальна відмова читання.')
  expect(screen.queryByText(savedRequest.motivation)).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))

  expect(await screen.findByText(savedRequest.motivation)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('успішний порожній список має окреме пояснення', async () => {
  requestService.getAll.mockResolvedValueOnce([])
  renderApp()

  expect(await screen.findByText(/Заявок ще немає/)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test.each([
  ['/requests/req-test-001', 'Заявка req-test-001'],
  ['/requests/req-test-001/edit', 'Редагування заявки req-test-001'],
  ['/requests/req-missing', 'Заявку не знайдено'],
  ['/requests/new?clubId=club-missing', 'Клуб нової заявки не знайдено'],
  ['/clubs/club-missing', 'Клуб не знайдено'],
  ['/unknown-page', '404: сторінку не знайдено'],
])('адреса %s відкриває відповідний екран', async (path, title) => {
  renderApp(path)
  expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
})

test('URL фільтра не змінює джерело заявок', async () => {
  renderApp('/requests?q=немає_такого_збігу&reminders=all&sort=hours-asc')

  expect(await screen.findByText('За цими умовами нічого не знайдено.'))
    .toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(requestService.delete).not.toHaveBeenCalled()
})

test('фільтр досвіду з URL показує лише відповідні заявки', async () => {
  requestService.getAll.mockResolvedValueOnce([
    savedRequest,
    {
      ...savedRequest,
      id: 'req-test-002',
      motivation: 'Шукаю глибші розмови про детективи.',
      experience: 'advanced',
    },
  ])
  renderApp('/requests?experience=advanced')

  expect(await screen.findByText('Шукаю глибші розмови про детективи.'))
    .toBeInTheDocument()
  expect(screen.queryByText(savedRequest.motivation)).not.toBeInTheDocument()
})

test('фільтр формату в каталозі клубів змінює адресу й список', async () => {
  const user = renderApp('/clubs')
  expect(await screen.findByText('Клуб детективів')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Онлайн' }))

  expect(screen.getByTestId('location')).toHaveTextContent('/clubs?format=online')
  expect(screen.getByText('Науково-популярний клуб')).toBeInTheDocument()
  expect(screen.queryByText('Клуб детективів')).not.toBeInTheDocument()
})

test('створює заявку та відкриває її підтверджені деталі', async () => {
  requestService.getAll.mockResolvedValueOnce([])
  const user = renderApp('/requests/new?clubId=club-001')

  await fillRequestForm(user)
  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  expect(await screen.findByRole('heading', { name: 'Заявка req-created' }))
    .toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/requests/req-created')
  expect(screen.getByText(validInput.motivation)).toBeInTheDocument()
  expect(screen.getByText(validInput.contactEmail)).toBeInTheDocument()
  expect(requestService.create).toHaveBeenCalledTimes(1)
  expect(requestService.create).toHaveBeenCalledWith(validInput)
  expect(screen.queryByRole('form', { name: 'Форма заявки на приєднання' }))
    .not.toBeInTheDocument()
})

test('головний сценарій: від картки клубу до створеної заявки', async () => {
  requestService.getAll.mockResolvedValueOnce([])
  const user = renderApp('/clubs/club-003')

  expect(await screen.findByRole('heading', { name: 'Клуб детективів' }))
    .toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Обрати й підготувати заявку' }))

  expect(await screen.findByRole('heading', { name: 'Нова заявка' })).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/requests/new?clubId=club-003')
  await fillRequestForm(user)
  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  expect(await screen.findByRole('heading', { name: 'Заявка req-created' }))
    .toBeInTheDocument()
  expect(requestService.create).toHaveBeenCalledWith({ ...validInput, clubId: 'club-003' })
  expect(screen.getByText('Клуб детективів')).toBeInTheDocument()
})

test('змінює заявку зі збереженням id та відкриває оновлені деталі', async () => {
  const user = renderApp('/requests/req-test-001/edit')
  const motivation = await screen.findByRole('textbox', { name: /Чому хочете приєднатися/ })

  await user.clear(motivation)
  await user.type(motivation, 'Оновлена мотивація для цієї заявки.')
  await user.click(screen.getByRole('button', { name: 'Зберегти зміни' }))

  expect(await screen.findByRole('heading', { name: 'Заявка req-test-001' }))
    .toBeInTheDocument()
  expect(requestService.update).toHaveBeenCalledWith('req-test-001', {
    ...validInput,
    motivation: 'Оновлена мотивація для цієї заявки.',
  })
  expect(screen.getByText('Оновлена мотивація для цієї заявки.')).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/requests/req-test-001')
})

test('скасування діалогу не викликає видалення', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const user = renderApp('/requests/req-test-001')
  await screen.findByRole('heading', { name: 'Заявка req-test-001' })

  await user.click(screen.getByRole('button', { name: 'Видалити заявку' }))

  expect(requestService.delete).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Заявка req-test-001' })).toBeInTheDocument()
})

test('відмова видалення залишає запис і поточну адресу', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  requestService.delete.mockRejectedValueOnce(
    new ServiceError('Не вдалося видалити заявку.'),
  )
  const user = renderApp('/requests/req-test-001')
  await screen.findByRole('heading', { name: 'Заявка req-test-001' })

  await user.click(screen.getByRole('button', { name: 'Видалити заявку' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Не вдалося видалити заявку.')
  expect(screen.getByText(savedRequest.motivation)).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/requests/req-test-001')
  expect(requestService.delete).toHaveBeenCalledWith(savedRequest.id)
})

test('підтверджене видалення прибирає запис і повертає до списку', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const user = renderApp('/requests/req-test-001')
  await screen.findByRole('heading', { name: 'Заявка req-test-001' })

  await user.click(screen.getByRole('button', { name: 'Видалити заявку' }))

  expect(await screen.findByText(/Заявок ще немає/)).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/requests$/)
  expect(requestService.delete).toHaveBeenCalledWith('req-test-001')
  expect(within(screen.getByRole('main')).queryByRole('table')).not.toBeInTheDocument()
})

// ---------- Вхід, реєстрація, права доступу ----------

test('гість перенаправляється на вхід, а після входу повертається на сторінку', async () => {
  signOut()
  const user = renderApp('/requests')

  expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument()
  expect(screen.getByText('Увійдіть, щоб продовжити.')).toBeInTheDocument()
  expect(requestService.getAll).not.toHaveBeenCalled()

  await user.type(screen.getByLabelText('Пошта'), 'demo@bookclub.test')
  await user.type(screen.getByLabelText('Пароль'), 'demo1234')
  await user.click(screen.getByRole('button', { name: 'Увійти' }))

  expect(await screen.findByRole('heading', { name: 'Заявки на приєднання' }))
    .toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent('/requests')
})

test('невірний пароль показує повідомлення й не відкриває сеанс', async () => {
  signOut()
  const user = renderApp('/login')

  await user.type(await screen.findByLabelText('Пошта'), 'demo@bookclub.test')
  await user.type(screen.getByLabelText('Пароль'), 'wrong-pass1')
  await user.click(screen.getByRole('button', { name: 'Увійти' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Невірна пошта або пароль.')
  expect(screen.getByRole('heading', { name: 'Вхід' })).toBeInTheDocument()
})

test('порожня форма входу пояснює, що заповнити, і не робить запит', async () => {
  signOut()
  const user = renderApp('/login')

  await user.click(await screen.findByRole('button', { name: 'Увійти' }))

  expect(screen.getByText('Вкажіть адресу пошти.')).toBeInTheDocument()
  expect(screen.getByText('Введіть пароль.')).toBeInTheDocument()
  expect(screen.getByLabelText('Пошта')).toHaveFocus()
})

test('реєстрація створює обліковий запис і входить у нього', async () => {
  signOut()
  const user = renderApp('/register')

  await user.type(await screen.findByLabelText('Імʼя'), 'Оксана Мельник')
  await user.type(screen.getByLabelText('Пошта'), 'oksana@example.com')
  await user.type(screen.getByLabelText('Пароль'), 'secret123')
  await user.click(screen.getByRole('button', { name: 'Зареєструватися' }))

  expect(await screen.findByRole('heading', { level: 1, name: /Читайте разом/ }))
    .toBeInTheDocument()
  expect(screen.getByText('Оксана Мельник')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Вийти' })).toBeInTheDocument()
})

test('вихід повертає на головну й закриває розділ заявок', async () => {
  const user = renderApp('/')
  const header = within(await screen.findByRole('banner'))
  expect(header.getByRole('link', { name: 'Мої заявки' })).toBeInTheDocument()

  await user.click(header.getByRole('button', { name: 'Вийти' }))

  expect(await header.findByRole('link', { name: 'Увійти' })).toBeInTheDocument()
  expect(header.queryByRole('link', { name: 'Мої заявки' })).not.toBeInTheDocument()
})

test('вихід із захищеної сторінки веде на головну, а не на вхід', async () => {
  const user = renderApp('/requests')
  await screen.findByRole('heading', { name: 'Заявки на приєднання' })

  await user.click(screen.getByRole('button', { name: 'Вийти' }))

  expect(await screen.findByRole('heading', { level: 1, name: /Читайте разом/ }))
    .toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
  expect(localStorage.getItem('bookclub.session.v1')).toBeNull()
})

test('гість не відкриває створення клубу', async () => {
  signOut()
  renderApp('/clubs/new')

  expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument()
})

// ---------- Клуби: створення, права власника ----------

test('створює власний клуб, який одразу з’являється в каталозі', async () => {
  const user = renderApp('/clubs/new')

  await user.type(await screen.findByLabelText('Назва клубу'), 'Клуб нічного читання')
  await user.type(screen.getByLabelText('Жанр'), 'Поезія')
  await user.type(screen.getByLabelText('Опис'), 'Читаємо вірші й говоримо про них.')
  await user.selectOptions(screen.getByLabelText('Формат зустрічей'), 'offline')
  await user.type(screen.getByLabelText('Найближча зустріч'), '2026-12-05')
  await user.click(screen.getByRole('button', { name: 'Створити клуб' }))

  expect(await screen.findByRole('heading', { name: 'Клуб нічного читання' }))
    .toBeInTheDocument()
  expect(screen.getByText('Клуб створено.')).toBeInTheDocument()
  expect(screen.getByText('Ваш клуб')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Редагувати клуб' })).toBeInTheDocument()
  const stored = JSON.parse(localStorage.getItem(customClubsKey))
  expect(stored).toHaveLength(1)
  expect(stored[0]).toMatchObject({
    name: 'Клуб нічного читання', ownerId: 'user-demo', membersCount: 1, format: 'offline',
  })

  await user.click(screen.getByRole('link', { name: 'До каталогу' }))
  expect(await screen.findByText('Клуб нічного читання')).toBeInTheDocument()
})

test('некоректна форма клубу не зберігається', async () => {
  const user = renderApp('/clubs/new')

  await user.click(await screen.findByRole('button', { name: 'Створити клуб' }))

  expect(screen.getByText(/Назва має містити від 3 до 60 символів/)).toBeInTheDocument()
  expect(screen.getByLabelText('Назва клубу')).toHaveFocus()
  expect(localStorage.getItem(customClubsKey)).toBeNull()
})

test('власник бачить дії над клубом, інший користувач ні', async () => {
  localStorage.setItem(customClubsKey, JSON.stringify([ownClub]))
  renderApp('/clubs/club-own-1')

  expect(await screen.findByRole('link', { name: 'Редагувати клуб' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Видалити клуб' })).toBeInTheDocument()
})

test('чужий клуб не можна редагувати ні кнопками, ні за адресою', async () => {
  localStorage.setItem(customClubsKey, JSON.stringify([ownClub]))
  signInOther()
  renderApp('/clubs/club-own-1/edit')

  expect(await screen.findByRole('heading', { name: 'Немає доступу' })).toBeInTheDocument()
})

test('на сторінці чужого клубу немає кнопок власника', async () => {
  localStorage.setItem(customClubsKey, JSON.stringify([ownClub]))
  signInOther()
  renderApp('/clubs/club-own-1')

  expect(await screen.findByRole('heading', { name: 'Мій клуб читання' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Редагувати клуб' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Видалити клуб' })).not.toBeInTheDocument()
})

test('власник редагує клуб і бачить оновлену назву', async () => {
  localStorage.setItem(customClubsKey, JSON.stringify([ownClub]))
  const user = renderApp('/clubs/club-own-1/edit')
  const name = await screen.findByLabelText('Назва клубу')

  await user.clear(name)
  await user.type(name, 'Оновлена назва клубу')
  await user.click(screen.getByRole('button', { name: 'Зберегти зміни' }))

  expect(await screen.findByRole('heading', { name: 'Оновлена назва клубу' }))
    .toBeInTheDocument()
  expect(screen.getByText('Зміни клубу збережено.')).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem(customClubsKey))[0]).toMatchObject({
    id: 'club-own-1', name: 'Оновлена назва клубу', membersCount: 1, ownerId: 'user-demo',
  })
})

test('власник видаляє клуб після підтвердження', async () => {
  localStorage.setItem(customClubsKey, JSON.stringify([ownClub]))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const user = renderApp('/clubs/club-own-1')

  await user.click(await screen.findByRole('button', { name: 'Видалити клуб' }))

  expect(await screen.findByText('Клуб видалено.')).toBeInTheDocument()
  expect(screen.getByTestId('location')).toHaveTextContent(/^\/clubs$/)
  expect(screen.queryByText('Мій клуб читання')).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem(customClubsKey))).toEqual([])
})

test('скасоване видалення лишає клуб на місці', async () => {
  localStorage.setItem(customClubsKey, JSON.stringify([ownClub]))
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  const user = renderApp('/clubs/club-own-1')

  await user.click(await screen.findByRole('button', { name: 'Видалити клуб' }))

  expect(screen.getByRole('heading', { name: 'Мій клуб читання' })).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem(customClubsKey))).toHaveLength(1)
})

test('фільтр «лише мої клуби» показує тільки створені мною', async () => {
  localStorage.setItem(customClubsKey, JSON.stringify([ownClub]))
  renderApp('/clubs?mine=1')

  expect(await screen.findByText('Мій клуб читання')).toBeInTheDocument()
  expect(screen.queryByText('Клуб детективів')).not.toBeInTheDocument()
})

test('заявка на створений клуб проходить перевірку наявності клубу', async () => {
  localStorage.setItem(customClubsKey, JSON.stringify([ownClub]))
  requestService.getAll.mockResolvedValueOnce([])
  const user = renderApp('/requests/new?clubId=club-own-1')

  await fillRequestForm(user, { ...validInput, clubId: 'club-own-1' })
  await user.click(screen.getByRole('button', { name: 'Створити заявку' }))

  expect(await screen.findByRole('heading', { name: 'Заявка req-created' })).toBeInTheDocument()
  expect(requestService.create).toHaveBeenCalledWith({ ...validInput, clubId: 'club-own-1' })
})
