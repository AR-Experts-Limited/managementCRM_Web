const BlurModal = ({ children, isOpen, onClose }) => {
  return (
    <div className={`fixed inset-0 z-[800] ${isOpen ? '' : 'pointer-events-none'}`}>
      {/* Overlay: blurs the page behind the modal */}
      <div
        className={`absolute inset-0 bg-white/30
                    transition-opacity duration-200
                    ${isOpen ? 'opacity-100' : 'opacity-0'}
                    backdrop-blur-md backdrop-saturate-150`}
        onClick={onClose}
      />

      {/* Centering layer */}
      <div className="relative h-full w-full flex items-center justify-center
                      px-4 py-8 sm:px-20 sm:py-12 md:px-48 md:py-20"
           onClick={onClose}>
        {/* Panel: glassmorphism */}
        <div
          className={`relative w-full max-w-[75rem] max-h-[80vh] overflow-auto
                      rounded-2xl
                      bg-white/15 dark:bg-white/10
                      backdrop-blur-md backdrop-saturate-150
                      border border-white/20 dark:border-white/10
                      shadow-[0_12px_50px_rgba(2,6,23,.35)]
                      text-slate-900 dark:text-slate-100
                      transition-transform transition-opacity duration-300
                      ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* subtle inner ring */}
          <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20" />
          {/* corner glaze */}
          <span className="pointer-events-none absolute -top-8 -left-8 h-24 w-24
                           rounded-full bg-white/60 blur-2xl opacity-50 mix-blend-overlay" />
          {/* top sheen */}
          <span className="pointer-events-none absolute -top-4 left-0 right-0 h-8
                           bg-gradient-to-b from-white/40 to-transparent opacity-40" />

          <div className="relative">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlurModal;
