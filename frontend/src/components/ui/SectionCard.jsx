import "./ui.css";

export default function SectionCard({
  as: Tag = "section",
  className = "",
  title,
  description,
  actions = null,
  children
}) {
  return (
    <Tag className={`ui-section-card ${className}`.trim()}>
      {title || description || actions ? (
        <div className="ui-section-head">
          <div className="ui-section-copy">
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="ui-section-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
