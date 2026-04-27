export default function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-ink-800 border border-ink-600 rounded-xl shadow-2xl w-full ${
          wide ? "max-w-3xl" : "max-w-lg"
        } flex flex-col max-h-[85vh]`}
      >
        <div className="px-5 py-3 border-b border-ink-700 flex items-center">
          <div className="font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="ml-auto text-ink-400 hover:text-ink-100"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto scrollbar-thin">
          {children}
        </div>
        {footer && (
          <div className="px-5 py-3 border-t border-ink-700 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
