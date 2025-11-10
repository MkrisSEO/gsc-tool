'use client';

import { useState, KeyboardEvent } from 'react';

interface UrlChipsInputProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  placeholder?: string;
}

export default function UrlChipsInput({ urls, onChange, placeholder = 'https://example.com' }: UrlChipsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addUrl(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && urls.length > 0) {
      // Remove last URL if backspace on empty input
      removeUrl(urls.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    // Split by newlines, commas, spaces, or tabs
    const pastedUrls = pastedText
      .split(/[\n,\s\t]+/)
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (pastedUrls.length > 0) {
      const newUrls = [...urls];
      pastedUrls.forEach((url) => {
        if (url && !newUrls.includes(url)) {
          newUrls.push(url);
        }
      });
      onChange(newUrls);
      setInputValue('');
    }
  };

  const addUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed && !urls.includes(trimmed)) {
      onChange([...urls, trimmed]);
      setInputValue('');
    } else {
      setInputValue('');
    }
  };

  const removeUrl = (index: number) => {
    onChange(urls.filter((_, i) => i !== index));
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    
    // Auto-detect paste with multiple lines
    if (value.includes('\n')) {
      const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1) {
        const newUrls = [...urls];
        lines.forEach((line) => {
          if (line && !newUrls.includes(line)) {
            newUrls.push(line);
          }
        });
        onChange(newUrls);
        setInputValue('');
      }
    }
  };

  const totalChars = urls.join('').length + inputValue.length;

  return (
    <div
      style={{
        padding: 12,
        border: '2px solid #3b82f6',
        borderRadius: 8,
        minHeight: 120,
        background: '#fff',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'flex-start',
        alignContent: 'flex-start',
        position: 'relative',
      }}
    >
      {/* URL Chips */}
      {urls.map((url, index) => (
        <div
          key={index}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: '#e2e8f0',
            borderRadius: 16,
            fontSize: 13,
            color: '#0f172a',
          }}
        >
          <span>{url}</span>
          <button
            onClick={() => removeUrl(index)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 0,
              fontSize: 16,
              lineHeight: 1,
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      ))}

      {/* Input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (inputValue.trim()) {
            addUrl(inputValue);
          }
        }}
        placeholder={urls.length === 0 ? placeholder : ''}
        style={{
          flex: 1,
          minWidth: 200,
          border: 'none',
          outline: 'none',
          fontSize: 13,
          padding: '6px 4px',
          background: 'transparent',
        }}
      />

      {/* Character count */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          fontSize: 11,
          color: '#94a3b8',
        }}
      >
        {totalChars}/4096
      </div>
    </div>
  );
}

