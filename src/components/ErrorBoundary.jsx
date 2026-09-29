import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[PRGARCIA] Error inesperado en la interfaz.', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ocurrió un problema</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">No pudimos mostrar esta pantalla. Recarga la página para intentarlo de nuevo.</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Recargar página</button>
        </main>
      );
    }

    return this.props.children;
  }
}