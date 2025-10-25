
import React, { useState, useRef, useEffect } from 'react';
import { WorkMode } from '../types';
import { PROMPT_SUGGESTIONS } from '../constants';
import ImageComparator from './ImageComparator';
import MaskingCanvas from './MaskingCanvas';

interface WorkspaceProps {
  activeMode: WorkMode;
  originalImage: string | null;
  resultImage: string | null;
  backgroundImage: string | null;
  onImageUpload: (file: File) => void;
  onClearImage: () => void;
  isLoading: boolean;
  onGenerate: (prompt: string) => void;
  onCommitResult: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isApiKeySet: boolean;
  isCoolingDown: boolean;
  onOpenApiKeyModal: () => void;
  // Masking Props
  isMasking: boolean;
  identityMask: string | null;
  onMaskChange: (mask: string | null) => void;
  brushSize: number;
}

const ImageUploadPlaceholder: React.FC<{ onImageUpload: (file: File) => void }> = ({ onImageUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      onClick={handleClick}
      className="w-full h-full border-2 border-dashed border-gray-600 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:border-blue-500 hover:bg-gray-800/50 transition-all"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-gray-500 mb-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
      </svg>
      <p className="text-gray-400">Nhấn vào đây để tải ảnh lên</p>
      <p className="text-xs text-gray-500">PNG, JPG, WEBP</p>
    </div>
  );
};

const Workspace: React.FC<WorkspaceProps> = ({ 
  activeMode, originalImage, resultImage, backgroundImage, onImageUpload, onClearImage, isLoading, onGenerate, onCommitResult, onUndo, onRedo, canUndo, canRedo, isApiKeySet, isCoolingDown, onOpenApiKeyModal,
  isMasking, identityMask, onMaskChange, brushSize
}) => {
  const [prompt, setPrompt] = useState('');
  const [compareMode, setCompareMode] = useState<'slider' | 'side-by-side'>('slider');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [exportResolution, setExportResolution] = useState<'original' | '4k' | '8k'>('original');
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const exportPopoverRef = useRef<HTMLDivElement>(null);
  const imageDisplayContainerRef = useRef<HTMLDivElement>(null);

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(current => current ? `${current}, ${suggestion}` : suggestion);
  };

  const loadSuggestions = (mode: WorkMode) => {
    const allSuggestions = PROMPT_SUGGESTIONS[mode];
    const shuffled = [...allSuggestions].sort(() => 0.5 - Math.random());
    setCurrentSuggestions(shuffled.slice(0, 5));
  };
  
  const handleGenerateClick = () => {
    onGenerate(prompt);
  };

  const handleDownload = () => {
    if (!resultImage) return;

    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = img.width;
        let height = img.height;
        const aspectRatio = width / height;

        const resolutions = {
            '4k': 3840,
            '8k': 7680,
        };

        if (exportResolution !== 'original') {
            const targetLongestEdge = resolutions[exportResolution];

            if (width >= height) { // Landscape or square
                canvas.width = targetLongestEdge;
                canvas.height = targetLongestEdge / aspectRatio;
            } else { // Portrait
                canvas.height = targetLongestEdge;
                canvas.width = targetLongestEdge * aspectRatio;
            }
        } else {
            canvas.width = width;
            canvas.height = height;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const link = document.createElement('a');
        link.download = `edited-image-${Date.now()}.${exportFormat}`;
        link.href = canvas.toDataURL(`image/${exportFormat}`, exportFormat === 'jpeg' ? 0.9 : undefined);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowExportMenu(false);
    };
    img.src = resultImage;
  };
  
  // When a new result is generated, default to slider view
  useEffect(() => {
    if (resultImage) {
      setCompareMode('slider');
    }
  }, [resultImage]);

  // When mode changes, load new suggestions for the current mode
  useEffect(() => {
    loadSuggestions(activeMode);
  }, [activeMode]);
  
  // Handle clicking outside the export menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            showExportMenu &&
            exportButtonRef.current &&
            !exportButtonRef.current.contains(event.target as Node) &&
            exportPopoverRef.current &&
            !exportPopoverRef.current.contains(event.target as Node)
        ) {
            setShowExportMenu(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const isCompositePreview = activeMode === WorkMode.COMPOSITE && originalImage && backgroundImage && !resultImage;

  return (
    <div className="flex-1 flex flex-col bg-gray-900 rounded-lg overflow-hidden h-full">
      <div className="flex-shrink-0 flex items-center justify-between p-2 border-b border-gray-700/50 bg-gray-800/20">
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex items-center gap-2 px-4 py-1.5 bg-gray-700 text-white rounded-md backdrop-blur-sm hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Quay lại"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
            <span>Quay lại</span>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex items-center gap-2 px-4 py-1.5 bg-gray-700 text-white rounded-md backdrop-blur-sm hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Làm lại"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
            </svg>
            <span>Làm lại</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={onOpenApiKeyModal}
                className="flex items-center gap-2 px-4 py-1.5 bg-gray-700 text-white rounded-md backdrop-blur-sm hover:bg-gray-600 transition-colors"
                aria-label="Cài đặt API Key"
              >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
              <span>API Key</span>
            </button>
        </div>
      </div>
      <div className="flex-grow p-4 flex justify-center items-center relative min-h-0">
        {originalImage ? (
          <div className="flex w-full h-full gap-4">
            <div className="flex-[2] flex flex-col items-center justify-center bg-gray-900/50 rounded-lg p-2 relative">
              <h3 className="absolute top-2 left-3 text-sm font-bold text-gray-400 bg-gray-800/80 px-3 py-1 rounded-full z-20">Ảnh Gốc</h3>
              <button
                onClick={onClearImage}
                className="absolute top-2 right-2 p-1 bg-gray-800/80 text-white rounded-full hover:bg-red-500 transition-colors z-20"
                aria-label="Xóa ảnh gốc"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
               <div ref={imageDisplayContainerRef} className="relative w-full h-full flex items-center justify-center">
                  <img src={originalImage} alt="Ảnh Gốc" className="max-w-full max-h-full object-contain rounded-md" />
                   {activeMode === WorkMode.CREATIVE && isMasking && (
                      <MaskingCanvas 
                        imageSrc={originalImage}
                        brushSize={brushSize}
                        onMaskChange={onMaskChange}
                      />
                  )}
              </div>
            </div>
            
            <div className="flex-[3] flex flex-col items-center justify-center bg-gray-800/30 rounded-lg relative overflow-hidden p-2">
              <div className="absolute top-2 right-2 flex items-center gap-2 z-20">
                 {resultImage && (
                  <div className="flex items-center bg-gray-800/80 rounded-full p-1 text-gray-300 backdrop-blur-sm">
                    <button 
                      onClick={() => setCompareMode('slider')} 
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${compareMode === 'slider' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
                      aria-label="So sánh trượt"
                    >
                      Trượt
                    </button>
                    <button 
                      onClick={() => setCompareMode('side-by-side')} 
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${compareMode === 'side-by-side' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
                      aria-label="So sánh song song"
                    >
                      Song song
                    </button>
                  </div>
                )}
                <h3 className="text-sm font-bold text-gray-400 bg-gray-800/80 px-3 py-1 rounded-full z-10">Kết Quả</h3>
              </div>
              
              <div className="w-full h-full flex items-center justify-center">
                {isCompositePreview ? (
                  <div className="relative w-full h-full">
                    <img src={backgroundImage!} alt="Nền" className="absolute inset-0 w-full h-full object-contain rounded-md" />
                    <img src={originalImage} alt="Chủ thể" className="absolute inset-0 w-full h-full object-contain rounded-md opacity-80" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' }} />
                  </div>
                ) : resultImage && originalImage ? (
                  compareMode === 'slider' ? (
                    <ImageComparator originalImage={originalImage} resultImage={resultImage} />
                  ) : (
                    <div className="flex w-full h-full gap-2 items-center justify-center">
                      <div className="flex-1 h-full relative">
                          <h4 className="absolute top-1 left-1 text-xs font-bold text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-full z-10">Trước</h4>
                          <img src={originalImage} alt="Trước" className="w-full h-full object-contain rounded-md" />
                      </div>
                      <div className="flex-1 h-full relative">
                          <h4 className="absolute top-1 left-1 text-xs font-bold text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-full z-10">Sau</h4>
                          <img src={resultImage} alt="Sau" className="w-full h-full object-contain rounded-md" />
                      </div>
                    </div>
                  )
                ) : (
                  originalImage && <img src={originalImage} alt="Kết quả" className="max-w-full max-h-full object-contain rounded-md shadow-lg" />
                )}
              </div>

              {resultImage && !isLoading && (
                 <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                    <div className="relative">
                        <button
                            ref={exportButtonRef}
                            onClick={() => setShowExportMenu(p => !p)}
                            className="p-2 bg-gray-700/80 text-white rounded-lg backdrop-blur-sm hover:bg-gray-600 transition-colors"
                            aria-label="Xuất ảnh"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                        </button>
                        {showExportMenu && (
                            <div ref={exportPopoverRef} className="absolute bottom-full right-0 mb-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 z-30">
                                <h4 className="text-md font-bold text-white mb-3">Tùy chọn xuất ảnh</h4>
                                
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Định dạng</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setExportFormat('png')} className={`flex-1 text-sm rounded py-1 transition-colors ${exportFormat === 'png' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>PNG</button>
                                        <button onClick={() => setExportFormat('jpeg')} className={`flex-1 text-sm rounded py-1 transition-colors ${exportFormat === 'jpeg' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>JPG</button>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Độ phân giải</label>
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => setExportResolution('original')} className={`w-full text-left text-sm rounded p-2 transition-colors ${exportResolution === 'original' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Gốc</button>
                                        <button onClick={() => setExportResolution('4k')} className={`w-full text-left text-sm rounded p-2 transition-colors ${exportResolution === '4k' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>4K (Nâng cấp)</button>
                                        <button onClick={() => setExportResolution('8k')} className={`w-full text-left text-sm rounded p-2 transition-colors ${exportResolution === '8k' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>8K (Nâng cấp)</button>
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={handleDownload}
                                    className="w-full font-semibold bg-green-600 hover:bg-green-700 rounded py-2 transition-colors text-white"
                                >
                                    Tải xuống
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <button 
                        onClick={onCommitResult} 
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600/80 text-white rounded-lg backdrop-blur-sm hover:bg-blue-700 transition-colors"
                        aria-label="Sử dụng ảnh này để sửa tiếp"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                        <span>Sửa tiếp</span>
                    </button>
                 </div>
              )}


              {isLoading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col justify-center items-center backdrop-blur-sm rounded-md">
                  <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-white mt-4 text-lg">AI đang xử lý...</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ImageUploadPlaceholder onImageUpload={onImageUpload} />
        )}
      </div>
      <div className="flex-shrink-0 p-6 border-t border-gray-700/50 bg-gray-800/30">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap justify-center min-h-[2.5rem]">
                {currentSuggestions.map((suggestion) => (
                    <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-full hover:bg-gray-600 transition-colors"
                    >
                    {suggestion}
                    </button>
                ))}
                <button
                    onClick={() => loadSuggestions(activeMode)}
                    className="p-1.5 bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600 transition-colors"
                    aria-label="Tải gợi ý mới"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.664 0l3.181-3.183m-4.991-2.696v4.992h-4.992" />
                    </svg>
                </button>
            </div>
            <div className="flex items-center gap-4">
            <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Mô tả những thay đổi bạn muốn..."
                className="flex-1 w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
                onClick={handleGenerateClick}
                disabled={isLoading || !originalImage || !isApiKeySet || isCoolingDown}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                title={!isApiKeySet ? "Vui lòng nhập API Key để tạo ảnh" : isCoolingDown ? "Đã đạt giới hạn yêu cầu, vui lòng đợi 1 phút." : ""}
            >
                {isCoolingDown ? 'Vui lòng đợi...' : 'Tạo'}
            </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
