import React from 'react';

interface VisuallyHiddenProps {
  children: React.ReactNode;
}

/**
 * Componente para anuncios accesibles a screen readers
 * El contenido es invisible visualmente pero legible por lectores de pantalla
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ children }) => {
  return (
    <span
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0',
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </span>
  );
};

export default VisuallyHidden;
