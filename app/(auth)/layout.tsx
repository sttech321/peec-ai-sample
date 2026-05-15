import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-left">{children}</div>
      <div className="auth-right" aria-hidden="true">
        <SocialProofPanel />
      </div>
    </div>
  );
}

function SocialProofPanel() {
  return (
    <div className="auth-sp-wrap">
      {/* Blurred background text */}
      <div className="auth-sp-blur-bg">
        <p>As LLMs like ChatGPT and Perplexity are driving traffic and conversions — Peec AI helps marketers capture these opportunities and get ahead with monitoring and insights tailored to AI and generative search</p>
        <br />
        <p>Crystal Carter — Head of SEO Communications</p>
      </div>

      {/* Testimonial card — clearly visible in center */}
      <div className="auth-sp-card">
        <p className="auth-sp-quote">
          &ldquo;Peec avoids the issues we see with other SEO/AEO platforms, where there&apos;s often an overload of features and information that isn&apos;t of primary importance. It keeps things simple - set up your prompts, see your AI visibility, and act on top citations.&rdquo;
        </p>
        <div className="auth-sp-author">
          <div className="auth-sp-avatar">ES</div>
          <div>
            <div className="auth-sp-name">Ethan Smith</div>
            <div className="auth-sp-role">CEO</div>
          </div>
          <div className="auth-sp-company">GRAPHITE</div>
        </div>
      </div>

      {/* Trusted by */}
      <div className="auth-sp-bottom">
        <p className="auth-sp-trusted">Trusted by +1500 marketing teams</p>
        <div className="auth-sp-logos-grid">
          <div className="auth-sp-logos-col">
            <p className="auth-sp-logos-heading">Brands</p>
            <div className="auth-sp-logos">
              {["Breitling", "Attio", "Squarespace", "Brevo", "n8n", "ElevenLabs"].map((b) => (
                <span key={b} className="auth-sp-logo-name">{b}</span>
              ))}
            </div>
          </div>
          <div className="auth-sp-logos-col">
            <p className="auth-sp-logos-heading">Agencies</p>
            <div className="auth-sp-logos">
              {["Seer", "Eskimoz", "Omniscient", "We Comms", "FirstPage", "Jin Global"].map((a) => (
                <span key={a} className="auth-sp-logo-name">{a}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
