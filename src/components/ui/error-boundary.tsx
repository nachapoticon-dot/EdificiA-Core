"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Custom fallback. If omitted, renders the default inline error card. */
  fallback?: ReactNode;
  /** Tool name shown in the default fallback ("No se pudo renderizar X") */
  label?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return <InlineErrorCard label={this.props.label} />;
  }
}

function InlineErrorCard({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[10px] border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        No se pudo renderizar{label ? ` "${label}"` : " este resultado"}.
      </span>
    </div>
  );
}
