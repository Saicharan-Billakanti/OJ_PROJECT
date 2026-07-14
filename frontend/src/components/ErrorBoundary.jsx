import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="not-found">
          <h1>⚠</h1>
          <h2>Something went wrong</h2>
          <p className="hint">This page hit an unexpected error. Try reloading.</p>
          <button onClick={() => window.location.assign("/")}>Back to Problems</button>
        </div>
      );
    }
    return this.props.children;
  }
}
