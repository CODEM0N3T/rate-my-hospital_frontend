import { NavLink } from "react-router-dom";
import "./Navigation.css";

export default function Navigation({
  loggedIn,
  onSignIn,
  onSignUp,
  onSignOut,
}) {
  return (
    <nav className="nav" aria-label="Primary">
      <NavLink to="/" className="nav__link">
        Home
      </NavLink>
      <NavLink to="/about" className="nav__link">
        About
      </NavLink>
      {!loggedIn ? (
        <>
          <button className="nav__btn" onClick={onSignIn}>
            Sign in
          </button>
          <button className="nav__btn nav__btn--primary" onClick={onSignUp}>
            Sign up
          </button>
        </>
      ) : (
        <button className="nav__btn" onClick={onSignOut}>
          Log out
        </button>
      )}
    </nav>
  );
}
