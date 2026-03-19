import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = "",
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs uppercase text-txt3 tracking-wider"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`bg-bg2 border border-border2 rounded px-3 py-2 text-sm font-mono text-txt focus:outline-none focus:border-cyan transition-colors ${error ? "border-red" : ""} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red">{error}</span>}
    </div>
  );
};
