import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <section className="state-banner state-error" role="alert">
        <span className="state-icon" aria-hidden="true">🛠️</span>
        <h2>Щось пішло не так на цій сторінці</h2>
        <p>Спробуйте оновити сторінку або перейдіть до іншого розділу.</p>
        <button
          type="button"
          className="app-button app-button-secondary"
          onClick={() => window.location.reload()}
        >
          Оновити сторінку
        </button>
      </section>
    )
  }
}