import { Outlet } from 'react-router'
import AuthProvider from '../../providers/AuthProvider.jsx'
import AuthGate from '../auth/AuthGate.jsx'

export default function SessionLayout() {
  return <AuthProvider><AuthGate><Outlet /></AuthGate></AuthProvider>
}
