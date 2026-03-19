import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  ...props
}) => {
  const baseClasses =
    "rounded font-mono transition-all duration-200 inline-flex items-center justify-center gap-2";
  const variantClasses = {
    primary: "bg-cyan text-black border border-cyan hover:bg-cyan/90",
    secondary:
      "bg-bg2 text-txt2 border border-border2 hover:bg-bg3 hover:text-txt",
    accent: "bg-cyan-dim text-cyan border border-cyan hover:bg-cyan/20",
    danger: "bg-red/10 text-red border border-red/30 hover:bg-red/20",
  };
  const sizeClasses = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
