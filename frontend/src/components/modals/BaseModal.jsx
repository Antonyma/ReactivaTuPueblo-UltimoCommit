import React, { useEffect, useId, useRef } from "react";
import { IconClose } from "../Icons.jsx";

export default function BaseModal({
  open,
  onClose,
  title,
  subtitle = null,
  icon = null,
  maxWidthClass = "max-w-lg",
  containerClassName = "bg-white rounded-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto",
  closeLabel = "Cerrar ventana",
  children,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && typeof focusable.focus === "function") {
        focusable.focus();
      } else {
        dialog.focus();
      }
    }, 0);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`${containerClassName} ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h3 id={titleId} className="font-black text-xl inline-flex items-center gap-2">
                {icon}
                <span>{title}</span>
              </h3>
              {subtitle && <p className="text-sm text-stone-600 mt-1">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="btn-cerrar-modal bg-stone-200 hover:bg-stone-300 text-stone-900 rounded-full w-10 h-10 inline-flex items-center justify-center shrink-0 transition"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

