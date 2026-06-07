import React from "react";
import { Link } from "react-router-dom";

const stats = [
  ["24/7", "Vault visibility"],
  ["V3", "Wallet controls"],
  ["1 HR", "Recovery session"],
  ["100%", "Wallet owned"],
];

const modules = [
  {
    title: "Inheritance Vault",
    text: "Deposit ETH, set an inactivity window, and define the wallet that can inherit.",
    tag: "Owner",
  },
  {
    title: "Recovery Center",
    text: "Passkey verification and oracle signatures keep recovery deliberate and time-bound.",
    tag: "Recovery",
  },
  {
    title: "Spending Controls",
    text: "Daily limits let owners move ETH from the vault without exposing the whole balance.",
    tag: "V3",
  },
];

const workflow = [
  ["01", "Connect", "Open the app with your Sepolia wallet."],
  ["02", "Configure", "Deposit ETH, set heir, and choose inactivity."],
  ["03", "Heartbeat", "Prove activity with a lightweight transaction."],
  ["04", "Recover", "Use biometric recovery only when access is lost."],
  ["05", "Transfer", "Let the heir claim only after inactivity rules pass."],
];

export default function LandingPage() {
  return (
    <main className="lv-landing">
      <nav className="lv-public-nav">
        <Link to="/" className="lv-public-logo" aria-label="LegacyVault home">
          <span className="lv-logo-mark">LV</span>
          <span>
            <strong>LEGACY</strong>
            <small>VAULT</small>
          </span>
        </Link>

        <div className="lv-public-links">
          <a href="#home" className="active">Home</a>
          <a href="#features">Features</a>
          <a href="#workflow">How It Works</a>
          <a href="#security">Security</a>
        </div>

        <Link to="/app" className="lv-nav-cta">
          Launch App <span>↗</span>
        </Link>
      </nav>

      <header id="home" className="lv-public-hero">
        <div className="lv-hero-glow" />
        <div className="lv-dummy-guardian" aria-hidden="true">
          <div className="lv-guardian-orbit" />
          <div className="lv-guardian-core">
            <span>LV</span>
          </div>
        </div>

        <section className="lv-hero-copy">
          <p className="lv-public-subtitle">WE PROTECT</p>
          <h1>
            DIGITAL
            <span> LEGACIES</span>
          </h1>
          <h2>BLOCKCHAIN INHERITANCE VAULT FOR SELF-CUSTODY OWNERS</h2>
          <p>
            A cinematic command center for ETH inheritance, heartbeat checks,
            biometric recovery, heir transfers, and controlled vault spending.
          </p>
          <div className="lv-hero-actions">
            <Link to="/app" className="lv-primary-pill">
              Launch App <span>↗</span>
            </Link>
            <a href="#workflow" className="lv-play-pill">
              <span>▶</span> Learn Flow
            </a>
          </div>
        </section>

        <aside className="lv-hero-rail">
          {[
            ["◆", "HEARTBEAT", "Dead-man switch"],
            ["◇", "HEIR", "Inheritance claim"],
            ["✦", "RECOVERY", "Biometric oracle"],
          ].map(([icon, title, detail]) => (
            <div key={title} className="lv-rail-item">
              <span>{icon}</span>
              <div>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
            </div>
          ))}
        </aside>
      </header>

      <section className="lv-stats-band">
        {stats.map(([value, label], index) => (
          <React.Fragment key={label}>
            <div className="lv-stat">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
            {index < stats.length - 1 && <div className="lv-stat-divider" />}
          </React.Fragment>
        ))}
      </section>

      <section id="features" className="lv-public-section">
        <div className="lv-public-heading">
          <p>CORE</p>
          <h2>PROTECTION MODULES</h2>
        </div>
        <div className="lv-module-grid">
          {modules.map((module) => (
            <article key={module.title} className="lv-module-card">
              <div className="lv-module-art">
                <span>{module.tag}</span>
              </div>
              <div className="lv-module-copy">
                <h3>{module.title}</h3>
                <p>{module.text}</p>
                <Link to="/app" aria-label={`Open ${module.title}`}>
                  →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="lv-workflow-section">
        <div className="lv-public-heading">
          <p>HOW IT</p>
          <h2>WORKS</h2>
        </div>
        <div className="lv-workflow-grid">
          <div className="lv-workflow-line" />
          {workflow.map(([num, title, text], index) => (
            <article
              key={title}
              className={`lv-workflow-step ${index === 2 ? "active" : ""}`}
            >
              <span>{num}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="lv-security-footer">
        <div className="lv-footer-card">
          <div>
            <h2>
              READY TO SECURE
              <br />
              SOMETHING <span>IRREPLACEABLE?</span>
            </h2>
            <p>
              Launch the Sepolia demo, connect your wallet, and configure the
              vault controls that define your legacy plan.
            </p>
            <Link to="/app" className="lv-primary-pill">
              Enter Command Center <span>↗</span>
            </Link>
          </div>
          <div className="lv-footer-contact">
            <p>LEGACYVAULT</p>
            <span>Dead-man switch</span>
            <span>Heir transfer</span>
            <span>Biometric recovery</span>
            <span>Daily spending limits</span>
          </div>
        </div>
        <div className="lv-public-bottom">
          <p>LegacyVault. Sepolia demo network.</p>
          <p>Wallet-owned inheritance infrastructure.</p>
        </div>
      </section>
    </main>
  );
}
