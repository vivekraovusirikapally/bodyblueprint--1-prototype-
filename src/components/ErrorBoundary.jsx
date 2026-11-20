import { Component } from "react";

/**
 * Catches render errors in its children so one broken widget cannot blank the whole page.
 * `resetKeys`: when any of these values change (for example the active tab) the error clears itself.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI error caught by ErrorBoundary:", error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps) {
    const a = prevProps.resetKeys ?? [];
    const b = this.props.resetKeys ?? [];
    if (this.state.error && (a.length !== b.length || a.some((v, i) => !Object.is(v, b[i])))) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="card error-card">
        <h2>{this.props.title ?? "Something went wrong"}</h2>
        <p className="muted">This part of the page hit an unexpected problem. Your saved data is safe.</p>
        <div className="row wrap">
          <button className="primary" onClick={this.reset}>Try again</button>
          {this.props.onReset && <span className="muted small">If it keeps happening, reset the demo data from the footer.</span>}
        </div>
      </div>
    );
  }
}
