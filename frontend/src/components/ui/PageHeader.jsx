import { Link } from "react-router-dom";
import "./ui.css";

function Breadcrumbs({ items }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className="ui-breadcrumbs" aria-label="Хлебные крошки">
      <ol>
        {items.map((item, index) => {
          const key = `${item.label}-${index}`;
          const isLast = index === items.length - 1;
          return (
            <li key={key}>
              {item.to && !isLast ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
              {!isLast ? <span className="ui-breadcrumb-sep">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function PageHeader({
  className = "",
  kicker,
  title,
  subtitle,
  actions = null,
  breadcrumbs = []
}) {
  return (
    <header className={`ui-page-header ${className}`.trim()}>
      <div className="ui-page-header-copy">
        <Breadcrumbs items={breadcrumbs} />
        {kicker ? <p className="ui-page-kicker">{kicker}</p> : null}
        <h1 className="ui-page-title">{title}</h1>
        {subtitle ? <p className="ui-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ui-page-actions">{actions}</div> : null}
    </header>
  );
}
