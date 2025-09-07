import { Link } from "react-router-dom";
import Navigation from "../Navigation/Navigation.jsx";
import logo from "../../assets/images/rmh-logo.png";
import "./Header.css";

export default function Header({ loggedIn, onSignIn, onSignUp, onSignOut }) {
  return (
    <header className="header">
      <div className="header__inner container">
        {/* Clickable logo + title */}
        <Link
          to="/"
          className="header__brand"
          aria-label="Rate My Hospital — Home"
        >
          <img className="header__logo" src={logo} alt="" aria-hidden="true" />
          <span className="header__brand-text">Rate My Hospital</span>
        </Link>

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
