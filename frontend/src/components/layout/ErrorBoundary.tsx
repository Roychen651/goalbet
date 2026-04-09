import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  hasError: boolean;
}

/**
 * ErrorBoundary — Catches unhandled React render errors and shows a premium
 * fallback instead of a white screen of death.
 *
 * Usage: wrap <Outlet /> (or any subtree) inside AppShell.
 * The "Try again" button resets state + reloads — catching transient issues
 * like stale chunk references after a deploy.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GoalBet ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div
            className="card-elevated rounded-2xl border border-white/10 max-w-sm w-full p-8 text-center space-y-5"
          >
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl">
                📡
              </div>
            </div>

            {/* Copy */}
            <div className="space-y-2">
              <h2 className="font-bebas text-2xl tracking-wider text-white leading-tight">
                Broadcast Interrupted<br />
                <span className="text-lg text-white/50">שידור הופסק</span>
              </h2>
              <p className="text-text-muted text-sm leading-relaxed">
                We're experiencing technical difficulties.
                <br />Reload the feed.
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={this.handleReload}
              className="w-full py-2.5 rounded-xl bg-accent-green text-bg-base text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
