import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  onClear: () => void;
  currentKey: string | null;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, onClear, currentKey }) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    // Reset input value when modal is opened/closed
    setInputValue('');
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (inputValue.trim()) {
      onSave(inputValue.trim());
    }
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  const maskKey = (key: string | null) => {
    if (!key) return "Chưa có khóa";
    if (key.length <= 8) return "**********";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-6 m-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Quản lý API Key</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">API Key hiện tại</label>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
            <span className={`text-sm font-mono ${currentKey ? 'text-green-400' : 'text-gray-500'}`}>{maskKey(currentKey)}</span>
            {currentKey && (
              <button 
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300 hover:underline"
              >
                Xóa khóa
              </button>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-300 mb-2">
            {currentKey ? 'Nhập khóa mới để thay thế' : 'Nhập API Key của bạn'}
          </label>
          <input
            id="api-key-input"
            type="password"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="dán API Key vào đây..."
            className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="text-xs text-gray-500 bg-gray-900/50 p-3 rounded-md">
            <strong>Lưu ý:</strong> Khóa API của bạn sẽ chỉ được lưu trong phiên làm việc hiện tại (Session Storage) và sẽ bị xóa khi bạn đóng tab này.
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={!inputValue.trim()}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;