import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <Link to="/dashboard" className="brand">StudyMate AI</Link>
      <nav className="nav-links">
        {user ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/revision">Revision</Link>
            <Link to="/docs/upload">Upload</Link>
            <Link to="/doubt">Doubt Solver</Link>
            <button className="text-button" onClick={handleLogout}>Logout</button>
          </>
        ) : null}
      </nav>
    </header>
  );
};

export default Navbar;
