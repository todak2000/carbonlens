import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'unknown'}]`, error, info.componentStack)
  }

  handleReset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="p-4 rounded bg-red-900/20 border border-red-500/40 text-center space-y-2">
        <p className="text-[11px] text-red-300 font-mono">
          ⚠ {this.props.label ?? 'Section'} encountered an error
        </p>
        <p className="text-[9px] text-red-400/70 font-mono max-w-md mx-auto leading-tight">
          {this.state.error?.message}
        </p>
        <button onClick={this.handleReset}
          className="text-[10px] font-mono px-3 py-1 rounded bg-red-600/40 text-red-200 hover:bg-red-600/60 border border-red-500/30"
        >
          Retry
        </button>
      </div>
    )
  }
}
