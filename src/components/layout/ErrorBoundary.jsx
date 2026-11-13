import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false, chunk: false }

  static getDerivedStateFromError(error) {
    return { failed: true, chunk: error?.name === 'PageChunkError' }
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
        <span className="state-mark" aria-hidden="true">!</span>
        <h2>{this.state.chunk ? 'Не вдалося завантажити сторінку' : 'Щось пішло не так на цій сторінці'}</h2>
        <p>{this.state.chunk ? 'Перевірте з’єднання та оновіть сторінку. Можливо, ReadHub оновлено, а попередня версія файлів уже недоступна.' : 'Спробуйте оновити сторінку або перейдіть до іншого розділу.'}</p>
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
