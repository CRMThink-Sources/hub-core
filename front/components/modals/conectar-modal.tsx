import { useState, useEffect } from "react";

interface IConectarProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string) => void;
  qrCode: string | null;
}

export function ConectarModal({
  isOpen,
  onClose,
  onSave,
  qrCode,
}: IConectarProps) {
  const [timeLeft, setTimeLeft] = useState(20);
  const [valid, setValid] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    setTimeLeft(20);
    setValid(true);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setValid(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, qrCode]);

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md shadow-lg'>
        <div className='flex items-center justify-between mb-4 pb-3 border-b border-gray-100'>
          <h2 className='text-lg font-semibold text-black'>Conectar</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 transition-colors cursor-pointer'
          >
            ✕
          </button>
        </div>

        <div className='flex flex-col items-center gap-3 py-4'>
          {qrCode && valid ? (
            <>
              <img
                src={`data:image/png;base64,${qrCode}`}
                alt='QR Code'
                className='w-48 h-48'
              />
              <p className='text-sm text-gray-500'>
                Escaneie o QR Code com o WhatsApp
              </p>
              <p className='text-sm text-red-500'>Expira em: {timeLeft}s</p>
            </>
          ) : (
            <p className='text-sm text-gray-500'>QR Code expirado</p>
          )}
        </div>
        <div className='flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100'>
          <button
            onClick={onClose}
            className='px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors cursor-pointer'
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
