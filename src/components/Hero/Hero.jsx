import "./Hero.css";
import bg from "../../assets/images/hospital-hero.jpg";

export default function Hero({ children }) {
  return (
    <section className="hero" style={{ "--hero-bg": `url(${bg})` }}>
      <div className="hero__overlay" />
      <div className="hero__inner container">{children}</div>
    </section>
  );
}
