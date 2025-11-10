'use client';

import { CSSProperties, MouseEvent } from 'react';

interface ModernButtonProps {
  children: React.ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ModernButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
  style = {},
  className = '',
  size = 'md',
}: ModernButtonProps) {
  const baseStyles: CSSProperties = {
    fontFamily: 'inherit',
    fontWeight: 600,
    border: 'none',
    borderRadius: size === 'sm' ? '8px' : size === 'lg' ? '14px' : '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    letterSpacing: '0.3px',
    opacity: disabled ? 0.5 : 1,
  };

  const sizeStyles: CSSProperties = {
    sm: { padding: '8px 16px', fontSize: '13px' },
    md: { padding: '12px 24px', fontSize: '14px' },
    lg: { padding: '14px 28px', fontSize: '15px' },
  }[size];

  const variantStyles: CSSProperties = {
    primary: {
      background: 'linear-gradient(135deg, #0071E3 0%, #0058B3 100%)',
      color: '#FFFFFF',
      boxShadow: '0 4px 12px rgba(0, 113, 227, 0.25)',
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.08)',
      color: '#FFFFFF',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(10px)',
    },
    outline: {
      background: 'transparent',
      color: '#0071E3',
      border: '2px solid #0071E3',
    },
    danger: {
      background: '#EF4444',
      color: '#FFFFFF',
      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
    },
    ghost: {
      background: 'transparent',
      color: 'rgba(255, 255, 255, 0.9)',
      border: 'none',
    },
  }[variant];

  const handleMouseEnter = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    const target = e.currentTarget;
    target.style.transform = 'translateY(-2px)';
    
    if (variant === 'primary') {
      target.style.boxShadow = '0 8px 20px rgba(0, 113, 227, 0.35)';
      target.style.background = 'linear-gradient(135deg, #3B8FF3 0%, #0071E3 100%)';
    } else if (variant === 'secondary') {
      target.style.background = 'rgba(255, 255, 255, 0.12)';
      target.style.borderColor = 'rgba(0, 113, 227, 0.4)';
    } else if (variant === 'outline') {
      target.style.background = '#0071E3';
      target.style.color = '#FFFFFF';
      target.style.boxShadow = '0 8px 16px rgba(0, 113, 227, 0.25)';
    } else if (variant === 'danger') {
      target.style.background = '#DC2626';
      target.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.3)';
    } else if (variant === 'ghost') {
      target.style.background = 'rgba(255, 255, 255, 0.05)';
    }
  };

  const handleMouseLeave = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    const target = e.currentTarget;
    target.style.transform = 'translateY(0)';
    
    if (variant === 'primary') {
      target.style.boxShadow = '0 4px 12px rgba(0, 113, 227, 0.25)';
      target.style.background = 'linear-gradient(135deg, #0071E3 0%, #0058B3 100%)';
    } else if (variant === 'secondary') {
      target.style.background = 'rgba(255, 255, 255, 0.08)';
      target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    } else if (variant === 'outline') {
      target.style.background = 'transparent';
      target.style.color = '#0071E3';
      target.style.boxShadow = 'none';
    } else if (variant === 'danger') {
      target.style.background = '#EF4444';
      target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.2)';
    } else if (variant === 'ghost') {
      target.style.background = 'transparent';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        ...baseStyles,
        ...sizeStyles,
        ...variantStyles,
        ...style,
      }}
    >
      {children}
    </button>
  );
}


