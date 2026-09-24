import { Component, ReactNode } from 'react';
import { copyFor } from '../copy';

interface Props {
  children: ReactNode;
  /** Changing this (e.g. the route) clears the error, so moving on recovers. */
  resetKey: string;
  /** Nothing to show in place of a failed overlay: it just closes. */
  quiet?: boolean;
  onError?: () => void;
  locale?: 'en' | 'bg' | 'ru';
}

/**
 * Contains a render error to one screen or sheet, so the player, the tab bar
 * and progress keep working. The app-wide boundary stays the last resort.
 */
export class LocalBoundary extends Component<Props, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: { failed: boolean; key: string }) {
    return props.resetKey === state.key ? null : { failed: false, key: props.resetKey };
  }

  componentDidCatch(error: unknown) {
    console.error('Loro: a part of the screen failed', error);
    this.props.onError?.();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.quiet) return null;
    const c = copyFor(this.props.locale ?? 'en');
    return (
      <div role="alert" className="max-w-md mx-auto m-4 p-4 rounded-2xl bg-surface-container-low flex flex-col gap-2">
        <p className="text-body">{c.error.part}</p>
        <button type="button" onClick={() => window.location.reload()} className="self-start min-h-11 px-4 rounded-full bg-primary-container text-on-primary font-bold">
          {c.error.reload}
        </button>
      </div>
    );
  }
}
