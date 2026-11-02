import { useEffect } from 'react'
import { Navigate } from 'react-router'
import useAuth from '../hooks/useAuth.js'

// Вихід виконується на окремому публічному маршруті: так сторінка, з якої
// виходять (зокрема захищена), вже демонтована і охоронець не перенаправляє на вхід.
export default function LogoutPage() {
  const { logout } = useAuth()

  useEffect(() => {
    logout()
  }, [logout])

  return <Navigate to="/" replace />
}
