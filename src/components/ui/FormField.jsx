export default function FormField({ id, label, hint, children }) {
    return (
      <div className="form-field">
        <label htmlFor={id}>{label}</label>
        {children}
        {hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      </div>
    )
  }