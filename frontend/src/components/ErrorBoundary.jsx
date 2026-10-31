import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-xl shadow-md border border-red-200 p-6 space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h1 className="text-xl font-bold text-gray-900">Đã xảy ra lỗi hiển thị</h1>
            <p className="text-sm text-gray-600">
              {this.state.error?.message || 'Có lỗi phát sinh trong quá trình dựng giao diện.'}
            </p>
            {this.state.error?.stack && (
              <pre className="text-[11px] bg-gray-100 text-gray-800 p-3 rounded text-left overflow-x-auto max-h-36">
                {this.state.error.stack}
              </pre>
            )}
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800"
              >
                Tải lại trang
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('ticketrush_token');
                  window.location.href = '/';
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Xóa cache &amp; về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

