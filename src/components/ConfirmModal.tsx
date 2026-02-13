import React from 'react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-gray-900/95 border border-blue-500/40 shadow-xl p-6 md:p-7 animate-slide-up">
        <h3 className="text-lg md:text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-sm md:text-base text-gray-300 mb-6">{message}</p>

        <div className="flex flex-col sm:flex-row-reverse gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm md:text-base font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Please wait...' : confirmLabel}
          </button>
          <button
            onClick={loading ? undefined : onCancel}
            disabled={loading}
            className="inline-flex justify-center items-center px-4 py-2.5 rounded-lg border border-gray-600 text-sm md:text-base text-gray-200 hover:bg-gray-800 transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

