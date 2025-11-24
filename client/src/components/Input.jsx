import React from 'react';

export const Input = ({ value, onChange, placeholder, className = '' }) => {
    return (
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`bg-slate-800/50 border border-slate-700 text-white text-lg rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent block w-full p-4 outline-none transition-all placeholder:text-slate-500 ${className}`}
        />
    );
};
