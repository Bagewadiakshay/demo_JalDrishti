import React, { useState } from 'react';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  dismissible?: boolean;
}

const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onDismiss,
  dismissible = true,
}) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div
      className="w-full bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 px-4 py-3"
      role="alert"
    >
      <span className="text-lg leading-none mt-0.5 flex-shrink-0">⚠️</span>
      <div className="flex-1 text-sm font-medium text-red-800">{message}</div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0 p-0.5"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default ErrorBanner;
