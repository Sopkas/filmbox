import { Link } from "react-router-dom";
import "./HeroPage.css";

const watched = [
  {
    title: "\u0418\u043d\u0442\u0435\u0440",
    emphasis: "\u0441\u0442\u0435\u043b\u043b\u0430\u0440",
    meta: "\u041e\u0426\u0415\u041d\u041a\u0410 5/5  \u041f\u0420\u041e\u0421\u041c\u041e\u0422\u0420\u0415\u041d \u0412\u0427\u0415\u0420\u0410"
  },
  {
    title: "\u0411\u0435\u0433\u0443\u0449\u0438\u0439 \u043f\u043e ",
    emphasis: "\u043b\u0435\u0437\u0432\u0438\u044e 2049",
    meta: "\u041e\u0426\u0415\u041d\u041a\u0410 4.5/5  \u041f\u0420\u041e\u0421\u041c\u041e\u0422\u0420\u0415\u041d 2 \u0414\u041d\u042f \u041d\u0410\u0417\u0410\u0414"
  },
  {
    title: "\u041e\u0434\u043d\u0430\u0436\u0434\u044b \u0432 ",
    emphasis: "\u0413\u043e\u043b\u043b\u0438\u0432\u0443\u0434\u0435",
    meta: "\u041e\u0426\u0415\u041d\u041a\u0410 5/5  \u041f\u0420\u041e\u0421\u041c\u041e\u0422\u0420\u0415\u041d 4 \u0414\u041d\u042f \u041d\u0410\u0417\u0410\u0414"
  }
];

const pulseStats = [
  { label: "\u0444\u0438\u043b\u044c\u043c\u043e\u0432 \u0432 \u043b\u043e\u0433\u0435", value: "128" },
  { label: "\u0441\u0440\u0435\u0434\u043d\u044f\u044f \u043e\u0446\u0435\u043d\u043a\u0430", value: "4.6/5" },
  { label: "\u0437\u0430\u043c\u0435\u0442\u043e\u043a \u043a \u0444\u0438\u043b\u044c\u043c\u0430\u043c", value: "73" }
];

const featureRail = [
  "\u0443\u043c\u043d\u044b\u0439 \u043f\u043e\u0438\u0441\u043a",
  "\u043e\u0446\u0435\u043d\u043a\u0430 1-5",
  "\u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438",
  "\u0440\u0443\u0447\u043d\u043e\u0439 \u0432\u0432\u043e\u0434",
  "\u043b\u0438\u0447\u043d\u044b\u0439 top-10"
];

function MenuTrigger() {
  return (
    <button type="button" className="cine-menu-trigger" aria-label="Open menu">
      <span className="cine-line" />
      <span className="cine-line" />
    </button>
  );
}

function WatchedRow({ item }) {
  return (
    <div className="cine-list-row">
      <span className="cine-movie-title">
        {item.title}
        <em>{item.emphasis}</em>
        {item.suffix || ""}
      </span>
      <span className="cine-movie-meta">{item.meta}</span>
    </div>
  );
}

function FooterMarquee() {
  const text =
    "\u0441\u043c\u043e\u0442\u0440\u0438 \u043e\u0446\u0435\u043d\u0438\u0432\u0430\u0439 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0438\u0440\u0443\u0439 \u0442\u043e\u043f-10 " +
    "\u0441\u043c\u043e\u0442\u0440\u0438 \u043e\u0446\u0435\u043d\u0438\u0432\u0430\u0439 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0438\u0440\u0443\u0439 \u0442\u043e\u043f-10 " +
    "\u0441\u043c\u043e\u0442\u0440\u0438 \u043e\u0446\u0435\u043d\u0438\u0432\u0430\u0439 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0438\u0440\u0443\u0439 \u0442\u043e\u043f-10";

  return (
    <div className="cine-footer-marquee">
      <div className="cine-marquee-content">
        {text} {text}
      </div>
    </div>
  );
}

export default function HeroPage() {
  return (
    <div className="cine-page">
      <nav className="cine-nav">
        <div className="cine-brand">KinoPulse</div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to="/collections" style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Подборки</Link>
          <MenuTrigger />
        </div>
      </nav>

      <div className="cine-aura" />

      <section className="cine-hero">
        <div className="cine-hero-content">
          <h1 className="cine-title">
            {"\u0422\u0432\u043e\u0439 \u043a\u0438\u043d\u043e "}
            <br />
            <em>{"\u043f\u0443\u043b\u044c\u0441"}</em>
            <span className="cine-period">.</span>
          </h1>

          <div className="cine-split-layout">
            <div className="cine-text-column">
              <span className="cine-label">{"\u041e \u043f\u0440\u043e\u0435\u043a\u0442\u0435"}</span>
              <p className="cine-copy">
                {"KinoPulse \u043f\u043e\u043c\u043e\u0433\u0430\u0435\u0442 \u0432\u0435\u0441\u0442\u0438 \u043b\u0438\u0447\u043d\u044b\u0439 \u043a\u0438\u043d\u043e-\u0434\u043d\u0435\u0432\u043d\u0438\u043a: \u043d\u0430\u0445\u043e\u0434\u0438\u0442\u0435 \u0444\u0438\u043b\u044c\u043c\u044b, \u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u043e\u0446\u0435\u043d\u043a\u0438 \u043e\u0442 1 \u0434\u043e 5, \u043e\u0441\u0442\u0430\u0432\u043b\u044f\u0439\u0442\u0435 \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438 \u0438 \u0441\u043e\u0431\u0438\u0440\u0430\u0439\u0442\u0435 \u0441\u0432\u043e\u0439 Top-10 \u0432 \u043f\u0440\u043e\u0444\u0438\u043b\u0435."}
              </p>

              <div className="cine-floating-action">
                <Link to="/tracker" className="cine-btn-minimal">
                  {"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0442\u0440\u0435\u043a\u0435\u0440"}
                </Link>

                <div className="cine-pointer-wrap">
                  <div className="cine-diagonal-pointer" />
                </div>
              </div>
            </div>

            <div className="cine-image-column">
              <img
                src="https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2059&auto=format&fit=crop"
                alt="Cinematic Still"
                className="cine-hero-img"
              />
              <span className="cine-label cine-featured">
                {"\u0424\u0438\u0447\u0438: \u0443\u043c\u043d\u044b\u0439 \u043f\u043e\u0438\u0441\u043a, \u0440\u0435\u0439\u0442\u0438\u043d\u0433, \u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0438, Top-10"}
              </span>
            </div>
          </div>

          <div className="cine-pulse-board">
            {pulseStats.map((item) => (
              <div className="cine-stat-item" key={item.label}>
                <span className="cine-stat-label">{item.label}</span>
                <span className="cine-stat-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cine-feature-rail">
          {featureRail.map((item) => (
            <span key={item} className="cine-feature-chip">
              {item}
            </span>
          ))}
        </div>

        <div className="cine-watched-list">
          {watched.map((item) => (
            <WatchedRow key={`${item.title}${item.emphasis}`} item={item} />
          ))}
        </div>
      </section>

      <FooterMarquee />
    </div>
  );
}

