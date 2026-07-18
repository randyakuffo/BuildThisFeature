import React from "react";

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "The application encountered an unexpected error." };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("InboxOS render failure:", { message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">InboxOS could not display this data</h2>
            <p className="text-sm text-gray-500 mb-5">Some AI-generated data had an unexpected format.</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, message: "" });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Reload InboxOS
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
