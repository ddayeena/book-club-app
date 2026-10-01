import useRequests from '../../hooks/useRequests.js'
import AppButton from '../ui/AppButton.jsx'

export default function RequestNotice() {
  const { notice, dismissNotice } = useRequests()

  return (
    <div className="operation-notice">
      <p role="status">{notice}</p>
      {notice && (
        <AppButton variant="secondary" onClick={dismissNotice}>
          Закрити повідомлення
        </AppButton>
      )}
    </div>
  )
}