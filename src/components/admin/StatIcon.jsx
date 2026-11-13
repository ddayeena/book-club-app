const shapes = {
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 20v-2a6 6 0 0 0-3-5" /></>,
  clubs: <><path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3ZM12 6v15" /></>,
  members: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2M18 4l2 2 3-4" /></>,
  requests: <><path d="M7 4H4v18h16V4h-3M9 2h6v4H9ZM8 11h8M8 15h8M8 19h4" /></>,
}
export default function StatIcon({ type }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[type]}</svg>
}
