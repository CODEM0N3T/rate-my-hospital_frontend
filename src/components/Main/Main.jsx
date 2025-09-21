import "./Main.css";
export default function Main({ children }) {
  return (
    <main className="main container" id="main-content">
      {children}
    </main>
  );
}
