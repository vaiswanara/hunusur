import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder = '-- Select --', disabled = false, style = {}, name = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Find selected option
  const selectedOption = options.find(o => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : '';

  // Filter options based on search query
  const filteredOptions = options.filter(option =>
    (option.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine if dropdown should open upwards or downwards based on available viewport space
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If space below is less than 280px and we have more space above, open upwards
      if (spaceBelow < 280 && spaceAbove > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  // Autofocus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange({ target: { name, value: optionValue } }); // simulates standard target event
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'relative', 
        width: '100%', 
        ...style 
      }}
    >
      {/* Selection display toggle */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0.75rem',
          border: '1px solid #ddd',
          borderRadius: '6px',
          backgroundColor: disabled ? '#F5F5F5' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem',
          minHeight: '38px',
          boxSizing: 'border-box',
          userSelect: 'none'
        }}
      >
        <span style={{ color: displayLabel ? '#333' : '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown size={16} style={{ color: '#666', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {/* Floating Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: openUpwards ? '100%' : 'auto',
            top: openUpwards ? 'auto' : '100%',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '6px',
            boxShadow: openUpwards ? '0 -4px 12px rgba(0, 0, 0, 0.15)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
            marginBottom: openUpwards ? '4px' : '0',
            marginTop: openUpwards ? '0' : '4px',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}
        >
          {/* Autocomplete Input */}
          <div style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
            <input
              ref={inputRef}
              className="searchable-select-input"
              type="text"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: '0.85rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
              onClick={e => e.stopPropagation()} // prevent closing menu on click
            />
          </div>

          {/* Scrolled Options */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              maxHeight: '200px'
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#999', textAlign: 'center' }}>
                No results found
              </div>
            ) : (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    backgroundColor: option.value === value ? '#F2E6E6' : 'transparent',
                    color: option.value === value ? 'var(--color-maroon, #63131D)' : '#333',
                    fontWeight: option.value === value ? '600' : 'normal',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={e => {
                    if (option.value !== value) e.target.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={e => {
                    if (option.value !== value) e.target.style.backgroundColor = 'transparent';
                  }}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
