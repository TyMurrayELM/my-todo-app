import React from 'react';

const ToggleSwitch = ({ isOn, handleToggle, label }) => {
  return (
    <div className="flex items-center">
      {label && <span className="mr-2 text-sm text-gray-600">{label}</span>}
      <div 
        onClick={handleToggle}
        className={`relative inline-block w-10 h-6 rounded-full transition-colors duration-200 ease-in-out cursor-pointer ${
          isOn ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span 
          className={`absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
            isOn ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
};

export default ToggleSwitch;