'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ChartTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  enabled?: boolean;
}

export default function ChartTooltip({ children, content, enabled = true }: ChartTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  };

  const hideTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  useEffect(() => {
    if (!isVisible || !triggerRef.current) return;

    const updatePosition = () => {
      if (!triggerRef.current || !tooltipRef.current) return;
      
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      const tooltipWidth = tooltipRect.width || 280;
      const tooltipHeight = tooltipRect.height || 150;
      
      // Start with trigger center
      let x = triggerRect.left + triggerRect.width / 2;
      let y = triggerRect.top - tooltipHeight - 12;
      
      // Check if tooltip would go off right edge
      if (x + tooltipWidth / 2 > window.innerWidth - 10) {
        x = window.innerWidth - tooltipWidth / 2 - 10;
      }
      
      // Check if tooltip would go off left edge
      if (x - tooltipWidth / 2 < 10) {
        x = tooltipWidth / 2 + 10;
      }
      
      // Check if tooltip would go off top
      if (y < 10) {
        y = triggerRect.bottom + 12;
      }

      setPosition({ x, y });
    };

    // Initial position
    updatePosition();

    // Reposition after tooltip renders
    const timer = setTimeout(updatePosition, 20);

    return () => clearTimeout(timer);
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!enabled) return <>{children}</>;

  const tooltipElement = isVisible && isMounted ? (
    <div
      ref={tooltipRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: 260,
        maxWidth: 320,
        pointerEvents: 'auto',
      }}
    >
      {content}
    </div>
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        style={{ display: 'inline-block', position: 'relative' }}
      >
        {children}
      </div>
      {tooltipElement && typeof window !== 'undefined' && createPortal(tooltipElement, document.body)}
    </>
  );
}

