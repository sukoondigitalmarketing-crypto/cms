import React, { useState, useEffect, useRef, useId } from 'react';
import type { MaterialOption } from '../../lib/search/materialOption';
import { rankOptions } from '../../lib/search/searchUtils';
import { nextHighlightIndex, resolveSearchQuery } from '../../lib/search/comboboxNavigation';

export interface SearchableSelectProps {
  options: MaterialOption[];
  value: string | number | null | undefined;
  onChange: (id: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * ARIA combobox for material selection.
 *
 * The single shared material selector — every module that picks an inventory
 * item renders this component so the interaction contract stays identical.
 *
 * Search state is kept separate from the committed value: `search` is a
 * transient query that never touches `value`. Selection is committed only by
 * click/touch or Enter on a highlighted option — typing, blur and Tab never
 * commit, and Escape restores the previously committed value.
 */
export function SearchableSelect({ options, value, onChange, placeholder, disabled }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  // UI-only: true once the user has typed since focusing. Until then the input
  // renders the committed label and the first keystroke replaces it.
  const [hasStartedSearch, setHasStartedSearch] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const listboxId = `${useId()}-material-listbox`;

  const selectedOption = options.find((o) => o.id == value);
  const committedLabel = selectedOption ? selectedOption.label : '';
  const displayValue = hasStartedSearch ? search : committedLabel;
  // An untouched field lists everything; only a typed query filters.
  const filteredOptions = rankOptions(hasStartedSearch ? search : '', options);

  /** Close and discard the in-progress query. The committed value is untouched. */
  const revert = () => {
    setIsOpen(false);
    setSearch('');
    setHasStartedSearch(false);
    setHighlightedIndex(-1);
  };

  /** The only path that changes the committed value. */
  const commit = (option: MaterialOption) => {
    onChange(option.id);
    revert();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        revert();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep the highlighted option inside the scroll viewport.
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const node = listboxRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightedIndex]);

  /** Open on focus/click and pre-select the label so the first keystroke replaces it. */
  const openForEditing = () => {
    setIsOpen(true);
    if (!hasStartedSearch) inputRef.current?.select();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(
          nextHighlightIndex(isOpen ? 'next' : 'first', highlightedIndex, filteredOptions.length)
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(
          nextHighlightIndex(isOpen ? 'previous' : 'last', highlightedIndex, filteredOptions.length)
        );
        break;
      case 'Home':
        if (!isOpen) break;
        event.preventDefault();
        setHighlightedIndex(nextHighlightIndex('first', highlightedIndex, filteredOptions.length));
        break;
      case 'End':
        if (!isOpen) break;
        event.preventDefault();
        setHighlightedIndex(nextHighlightIndex('last', highlightedIndex, filteredOptions.length));
        break;
      case 'Enter':
        if (!isOpen) break;
        // An open listbox owns Enter — it must never submit the surrounding form.
        event.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          commit(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        if (!isOpen && !hasStartedSearch) break;
        // This Escape belongs to the listbox, not the surrounding modal.
        event.preventDefault();
        event.stopPropagation();
        revert();
        break;
      case 'Tab':
        // Tab / Shift+Tab move focus onward without committing.
        if (isOpen || hasStartedSearch) revert();
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        className={`w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white cursor-text'}`}
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          setSearch(resolveSearchQuery(hasStartedSearch, committedLabel, e.target.value));
          setHasStartedSearch(true);
          setIsOpen(true);
          // Typing never highlights; selection stays an explicit action.
          setHighlightedIndex(-1);
        }}
        onFocus={openForEditing}
        onClick={openForEditing}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          if (wrapperRef.current?.contains(e.relatedTarget as Node)) return;
          revert();
        }}
      />
      <div className="absolute right-3 top-2.5 pointer-events-none text-gray-400">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-auto bg-white border border-gray-300 rounded-lg shadow-xl">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
          ) : (
            <div role="listbox" id={listboxId} ref={listboxRef}>
              {filteredOptions.map((option, index) => (
                <div
                  key={option.id}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={value == option.id}
                  className={`px-3 py-2 text-sm cursor-pointer ${index === highlightedIndex ? 'bg-blue-50 text-blue-700' : ''} ${value == option.id ? 'font-bold' : ''}`}
                  // Keep focus on the input so blur can never pre-empt the click.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => commit(option)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
