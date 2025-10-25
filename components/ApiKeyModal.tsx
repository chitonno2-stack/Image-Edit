
import React, { useState } from 'react';
import { ApiKey } from '../types';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: ApiKey[];
  onAddKey: (key: string) => Promise<void>;
  onRemoveKey: (key: string) => void;
  onSetActiveKey: (key: string) => void;
}

const ApiKeyStatusIndicator: React.FC<{ status: ApiKey['status'] }> = ({ status }) => {
    const baseClasses = "w-2.5 h-2.5 rounded-full flex-shrink-0";
    switch (status) {
        case 'valid':
            return <div className={`${baseClasses} bg-green-500`} title="Hợp lệ"></div>;
        case 'invalid':
            return <div className={`${baseClasses} bg-red-500`} title="Không hợp lệ"></div>;
        case 'checking':
            return <div className={`${baseClasses} bg-yellow-500 animate-pulse`} title="Đang kiểm tra..."></div>;
        case 'unknown':
        default:
            return <div className={`${baseClasses} bg-gray-500`} title="Không rõ"></div>;
    }
};

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, apiKeys, onAddKey, onRemoveKey, onSetActiveKey }) => {
  const [inputValue, setInputValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!inputValue.trim()) return;
    setIsAdding(true);
    await onAddKey(inputValue.trim());
    setInputValue('');
    setIsAdding(false);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleAdd();
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return "**********";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg p-6 m-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Quản lý API Keys</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-2 bg-gray-900/50 p-3 rounded-lg max-h-60 overflow-y-auto">
          {apiKeys.length > 0 ? apiKeys.map(({ key, status, isActive }) => (
            <div key={key} className={`flex items-center justify-between p-2 rounded-md transition-colors ${isActive ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-gray-700/50'}`}>
                <div className="flex items-center gap-3">
                    <ApiKeyStatusIndicator status={status} />
                    <span className="font-mono text-sm text-gray-300">{maskKey(key)}</span>
                    {isActive && <span className="text-xs font-bold text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded-full">Đang dùng</span>}
                </div>
                <div className="flex items-center gap-2">
                    {!isActive && status === 'valid' && (
                        <button 
                            onClick={() => onSetActiveKey(key)}
                            className="text-xs text-green-400 hover:text-green-300 hover:underline px-2"
                        >
                            Sử dụng
                        </button>
                    )}
                    <button 
                        onClick={() => onRemoveKey(key)}
                        className="text-xs text-red-400 hover:text-red-300 hover:underline px-2"
                    >
                        Xóa
                    </button>
                </div>
            </div>
          )) : (
            <p className="text-center text-gray-500 text-sm py-4">Chưa có API Key nào.</p>
          )}
        </div>

        <div>
          <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-300 mb-2">
            Thêm API Key mới
          </label>
          <div className="flex gap-2">
            <input
              id="api-key-input"
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Dán API Key vào đây..."
              className="flex-1 w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAdd}
              disabled={isAdding || !inputValue.trim()}
              className="px-5 py-2 w-36 flex justify-center items-center bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
              ) : (
                'Thêm & Kiểm tra'
              )}
            </button>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 bg-gray-900/50 p-3 rounded-md">
            <strong>Lưu ý:</strong> Khóa API của bạn sẽ được lưu trữ trong trình duyệt (Local Storage) để sử dụng cho các lần truy cập sau.
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
