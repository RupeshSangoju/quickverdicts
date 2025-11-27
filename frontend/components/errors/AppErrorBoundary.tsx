"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { FiAlertTriangle, FiRefreshCw, FiHome } from "react-icons/fi";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================
// APP ERROR BOUNDARY (for Layout.tsx)
// ============================================

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error("AppErrorBoundary caught an error:", error);
    console.error("Error Info:", errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Log to external service in production
    if (process.env.NODE_ENV === "production") {
      this.logErrorToService(error, errorInfo);
    }
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    try {
      console.error("Production Error:", {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    } catch (loggingError) {
      console.error("Failed to log error:", loggingError);
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = process.env.NODE_ENV === "development";
      const { error, errorInfo } = this.state;

      return (
        <div className="min-h-screen bg-gradient-to-br from-[#f9f7f2] to-[#e8e4d9] flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-8 text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-4 rounded-full">
                    <FiAlertTriangle className="text-4xl" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">Oops! Something went wrong</h1>
                    <p className="text-red-100 mt-1">
                      We're sorry for the inconvenience
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-8">
                <div className="space-y-4">
                  <p className="text-gray-700 text-lg">
                    Don't worry, our team has been notified and we're working on fixing this issue.
                  </p>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-4">
                    <button
                      onClick={this.handleReset}
                      className="flex items-center gap-2 px-6 py-3 bg-[#0A2342] text-white rounded-lg font-semibold hover:bg-[#1a3666] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0A2342] focus:ring-offset-2"
                    >
                      <FiRefreshCw className="text-lg" />
                      <span>Try Again</span>
                    </button>
                    
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                    >
                      <FiHome className="text-lg" />
                      <span>Go to Homepage</span>
                    </Link>
                  </div>

                  {/* Contact Support */}
                  <div className="pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      If this problem persists, please{" "}
                      <Link
                        href="/contact"
                        className="text-[#0A2342] font-semibold hover:underline"
                      >
                        contact our support team
                      </Link>
                      .
                    </p>
                  </div>

                  {/* Development Error Details */}
                  {isDevelopment && error && (
                    <details className="mt-6">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900 select-none">
                        🔧 Developer Info (Development Only)
                      </summary>
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-auto">
                        <div className="space-y-4">
                          {/* Error Message */}
                          <div>
                            <h3 className="text-sm font-semibold text-red-600 mb-2">
                              Error Message:
                            </h3>
                            <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-200">
                              {error.message}
                            </pre>
                          </div>

                          {/* Stack Trace */}
                          {error.stack && (
                            <div>
                              <h3 className="text-sm font-semibold text-red-600 mb-2">
                                Stack Trace:
                              </h3>
                              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-200 max-h-64 overflow-auto">
                                {error.stack}
                              </pre>
                            </div>
                          )}

                          {/* Component Stack */}
                          {errorInfo?.componentStack && (
                            <div>
                              <h3 className="text-sm font-semibold text-red-600 mb-2">
                                Component Stack:
                              </h3>
                              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-200 max-h-64 overflow-auto">
                                {errorInfo.componentStack}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>

            {/* Error ID */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Error ID: {Date.now().toString(36).toUpperCase()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Please include this ID if you contact support
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}