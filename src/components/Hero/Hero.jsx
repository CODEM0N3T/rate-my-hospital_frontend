import "./Hero.css";
import bg from "../../assets/images/hospital-hero.jpg";

export default function Hero({ children }) {
  // We pass the bg via a CSS var so Vite resolves the asset
  return (
    <section className="hero" style={{ "--hero-bg": `url(${bg})` }}>
      <div className="hero__overlay" />
      <div className="hero__inner container">{children}</div>
    </section>
  );
}
