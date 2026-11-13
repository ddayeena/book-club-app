const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function checkEmail(email, errors) {
  if (email === '') {
    errors.email = 'Вкажіть адресу пошти.'
  } else if (email.length > 100 || !emailPattern.test(email)) {
    errors.email = 'Вкажіть коректну адресу пошти.'
  }
}

export function validateRegistration(input) {
  const errors = {}
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = normalizeEmail(input.email)
  const password = typeof input.password === 'string' ? input.password : ''

  if (name.length < 2 || name.length > 40) {
    errors.name = 'Імʼя має містити від 2 до 40 символів.'
  }

  checkEmail(email, errors)

  if (password.length < 8 || password.length > 72) {
    errors.password = 'Пароль має містити від 8 до 72 символів.'
  } else if (!/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Пароль має містити хоча б одну літеру й одну цифру.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, errors: {}, value: { name, email, password } }
}

export function validateLogin(input) {
  const errors = {}
  const email = normalizeEmail(input.email)
  const password = typeof input.password === 'string' ? input.password : ''

  checkEmail(email, errors)
  if (password === '') errors.password = 'Введіть пароль.'

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, errors: {}, value: { email, password } }
}
