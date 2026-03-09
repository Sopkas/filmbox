import { Link, NavLink } from "react-router-dom";
import { PRIMARY_NAV } from "../config/navigation";
import "./SiteHeader.css";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <a className="site-skip-link" href="#main-content">
        Перейти к контенту
      </a>
      <div className="site-header-inner">
        <div className="site-brand-wrap">
          <Link to="/" className="site-brand">
            KinoPulse
          </Link>
          <span className="site-brand-meta">Личный кинокомпас</span>
        </div>

        <nav className="site-nav" aria-label="Основная навигация">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `site-nav-link${isActive ? " is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
