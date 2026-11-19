import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro ao inicializar ambiente 3D:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#090a0d] p-6 text-center">
          <div className="glass max-w-md rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#d9ff3f]">Arena Tech</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Ambiente 3D indisponível</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Não foi possível iniciar o contexto WebGL neste dispositivo ou navegador.
            </p>
            {this.state.message && (
              <p className="mt-3 rounded-lg bg-black/40 p-2 text-xs text-zinc-500">{this.state.message}</p>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
