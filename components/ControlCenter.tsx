
import React from 'react';
import { WORK_MODES } from '../constants';
import type { WorkMode } from '../types';
import type { ModeInfo } from '../types';

interface ControlCenterProps {
  activeMode: WorkMode;
  setActiveMode: (mode: WorkMode) => void;
}

const ControlCenter: React.FC<ControlCenterProps> = ({ activeMode, setActiveMode }) => {
  return (
    <div className="p-4 flex flex-col gap-2 flex-1">
      <div>
        <h1 className="text-xl font-bold text-white mb-4">Ngô Tân AI</h1>
        <nav className="flex flex-col gap-2">
          {WORK_MODES.map((mode: ModeInfo) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
                activeMode === mode.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              {mode.icon}
              <span className="font-semibold">{mode.name}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default ControlCenter;
