import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export const Modal = ({ isOpen, onClose, title, children, className }: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Portalled to <body>: the page wrapper keeps a transform from its entry
  // animation, and a transformed ancestor becomes the containing block for
  // position:fixed children — which pinned the modal to the (tall) page
  // instead of the viewport, pushing it up behind the top bar.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div 
        ref={modalRef}
        className={cn(
          "relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 transform transition-all animate-fade-in-scale",
          className
        )}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="mt-2">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
