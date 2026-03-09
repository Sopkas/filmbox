import "./ui.css";

export default function StateBlock({
  variant = "info",
  title,
  message,
  actionLabel,
  onAction,
  className = ""
}) {
  return (
    <div className={`ui-state-block ui-state-${variant} ${className}`.trim()} role={variant === "error" ? "alert" : undefined}>
      {title ? <h3>{title}</h3> : null}
      {message ? <p>{message}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="ui-state-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
