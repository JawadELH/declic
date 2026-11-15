import { useEffect, useRef } from 'react';
import { IconX } from '@tabler/icons-react';

/** Feuille qui monte du bas de l'écran (fermeture : fond, croix ou Échap). */
export default function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-grip" aria-hidden />
        <header className="row between">
          <h2 className="sheet-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <IconX size={22} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
