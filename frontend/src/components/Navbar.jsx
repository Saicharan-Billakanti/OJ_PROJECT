import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        OJ Platform
      </Link>
      <div className="nav-links">
        <Link to="/">Problems</Link>
        {user && <Link to="/submissions">Submissions</Link>}
        {user?.role === "admin" && <Link to="/admin/problems">Manage Problems</Link>}
        {user ? (
          <>
            <Link to="/profile" className="nav-user">{user.fullName}</Link>
            <button className="secondary" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/signup">Signup</Link>
          </>
        )}
      </div>
    </nav>
  );
}
