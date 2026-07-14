import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <h2>Page not found</h2>
      <p className="hint">The page you're looking for doesn't exist.</p>
      <Link to="/">← Back to Problems</Link>
    </div>
  );
}
