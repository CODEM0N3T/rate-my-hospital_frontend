import Navigation from "../Navigation/Navigation.jsx";
import logo from "../../assets/images/rmh-logo.png"; // ← NEW
import "./Header.css";

export default function Header({ loggedIn, onSignIn, onSignUp, onSignOut }) {
  return (
    <header className="header">
      {/* <a className="skip-link" href="#main-content">
        Skip to content
      </a> */}
      <div className="header__inner container">
        <div className="header__brand">
          <img className="header__logo" src={logo} alt="" />
          <span className="header__brand-text">Rate My Hospital</span>
        </div>
        <Navigation
          loggedIn={loggedIn}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}
