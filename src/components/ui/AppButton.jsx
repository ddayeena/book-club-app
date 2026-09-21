export default function AppButton({
    children,
    type = 'button',
    variant = 'primary',
    disabled = false,
  }) {
    return (
      <button
        type={type}
        className={`app-button app-button-${variant}`}
        disabled={disabled}
      >
        {children}
      </button>
    )
  }