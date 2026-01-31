"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { ChevronDown, Search, MapPin, AlertCircle } from "lucide-react";
import type { LocationOption } from "@/types/signup.types";

/* ===========================================================
   TYPES
   =========================================================== */

interface LocationDropdownProps {
  label: string;
  value: string;
  onChange: (option: LocationOption) => void;
  options: LocationOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  error?: string;
  searchPlaceholder?: string;
  noOptionsMessage?: string;
  className?: string;
}

/* ===========================================================
   UTILITIES
   =========================================================== */

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight search matches in text
 */
function highlightMatch(text: string, search: string): React.ReactNode {
  if (!search.trim()) return text;

  try {
    const escaped = escapeRegex(search);
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));

    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 font-semibold rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  } catch (error) {
    // Fallback if regex fails
    console.warn("Highlight match error:", error);
    return text;
  }
}

/* ===========================================================
   MAIN COMPONENT
   =========================================================== */

export function LocationDropdown({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  required = false,
  loading = false,
  error,
  searchPlaceholder = "Type to search...",
  noOptionsMessage = "No options available",
  className = "",
}: LocationDropdownProps) {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ===========================================================
     FILTERED OPTIONS
     =========================================================== */

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;

    const lowerSearch = searchTerm.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(lowerSearch)
    );
  }, [options, searchTerm]);

  /* ===========================================================
     CLICK OUTSIDE HANDLER
     =========================================================== */

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
        setFocusedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  /* ===========================================================
     SCROLL TO FOCUSED OPTION
     =========================================================== */

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[
        focusedIndex
      ] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [focusedIndex]);

  /* ===========================================================
     EVENT HANDLERS
     =========================================================== */

  const handleOptionSelect = useCallback(
    (option: LocationOption) => {
      onChange(option);
      setSearchTerm("");
      setIsOpen(false);
      setFocusedIndex(-1);

      // Track selection
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "location_selected", {
          location_type: label.toLowerCase(),
          location_value: option.label,
        });
      }
    },
    [onChange, label]
  );

  const handleInputClick = useCallback(() => {
    if (!disabled && !isOpen) {
      // Only open if closed - don't toggle when already open
      setIsOpen(true);
      setFocusedIndex(-1);

      // Select all text so user can start typing to search
      setTimeout(() => {
        inputRef.current?.select();
      }, 0);

      // Track dropdown open
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "location_dropdown_opened", {
          location_type: label.toLowerCase(),
        });
      }
    }
  }, [disabled, isOpen, label]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchTerm(val);
      setFocusedIndex(-1);

      if (!isOpen) setIsOpen(true);

      // If user clears the input completely, clear the selection
      if (val === "" && value) {
        onChange({ value: "", label: "" });
      }

      // Track search (debounced via analytics)
      if (
        val.length >= 2 &&
        typeof window !== "undefined" &&
        (window as any).gtag
      ) {
        (window as any).gtag("event", "location_search", {
          location_type: label.toLowerCase(),
          search_length: val.length,
        });
      }
    },
    [isOpen, label, value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setFocusedIndex((prev) =>
              Math.min(prev + 1, filteredOptions.length - 1)
            );
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            setFocusedIndex((prev) => Math.max(prev - 1, -1));
          }
          break;

        case "Enter":
          e.preventDefault();
          if (isOpen && focusedIndex >= 0 && filteredOptions[focusedIndex]) {
            handleOptionSelect(filteredOptions[focusedIndex]);
          } else if (!isOpen) {
            setIsOpen(true);
          }
          break;

        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchTerm("");
          setFocusedIndex(-1);
          inputRef.current?.blur();
          break;

        case "Tab":
          // Allow tab to close dropdown
          if (isOpen) {
            setIsOpen(false);
            setSearchTerm("");
            setFocusedIndex(-1);
          }
          break;

        default:
          break;
      }
    },
    [disabled, isOpen, focusedIndex, filteredOptions, handleOptionSelect]
  );

  /* ===========================================================
     COMPUTED VALUES
     =========================================================== */

  const fieldId = `location-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const listboxId = `${fieldId}-listbox`;
  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || "";

  /* ===========================================================
     RENDER
     =========================================================== */

  return (
    <div className={`mb-4 ${className}`}>
      {/* Label */}
      <div className="block mb-2 text-base font-medium text-[#16305B]">
        {label} {required && <span className="text-red-500">*</span>}
      </div>

      {/* Dropdown Container */}
      <div className="relative" ref={dropdownRef}>
        {/* Input Field */}
        <div className="relative">
          {/* Search Icon */}
          {isOpen && !loading && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={18} className="text-gray-400" aria-hidden="true" />
            </div>
          )}

          {/* Input */}
          <input
            ref={inputRef}
            id={fieldId}
            type="text"
            placeholder={
              disabled
                ? "Please select previous option first"
                : isOpen
                ? searchPlaceholder
                : placeholder
            }
            className={`
              w-full border rounded-md py-3 pr-10
              focus:ring-2 focus:ring-[#16305B] outline-none
              text-[#16305B] bg-white placeholder-gray-400
              transition-all
              ${isOpen && !loading ? "pl-10" : "pl-4"}
              ${
                error
                  ? "border-red-300 focus:ring-red-200"
                  : "border-gray-300"
              }
              ${
                disabled
                  ? "bg-gray-100 cursor-not-allowed text-gray-500"
                  : "cursor-pointer hover:border-gray-400"
              }
            `}
            value={isOpen ? searchTerm : selectedLabel}
            onChange={handleSearchChange}
            onClick={handleInputClick}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            autoComplete="off"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-activedescendant={
              focusedIndex >= 0 ? `${fieldId}-option-${focusedIndex}` : undefined
            }
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-error` : undefined}
          />

          {/* Dropdown Icon / Loader */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {loading ? (
              <div
                className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#16305B]"
                role="status"
                aria-label="Loading options"
              />
            ) : (
              <ChevronDown
                size={20}
                className={`text-gray-400 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                } ${disabled ? "opacity-50" : ""}`}
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && !disabled && !loading && (
          <div
            id={listboxId}
            className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-60 overflow-hidden"
            role="listbox"
            aria-label={`${label} options`}
          >
            {filteredOptions.length > 0 ? (
              <div ref={listRef} className="overflow-y-auto max-h-60">
                {filteredOptions.map((option, index) => {
                  const isSelected = option.value === value;
                  const isFocused = focusedIndex === index;

                  return (
                    <div
                      key={option.value}
                      id={`${fieldId}-option-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`px-4 py-3 cursor-pointer text-[#16305B] border-b border-gray-100 last:border-b-0 transition-colors flex items-center gap-2 ${
                        isSelected
                          ? "bg-blue-100 font-semibold"
                          : isFocused
                          ? "bg-blue-50"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() => handleOptionSelect(option)}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <MapPin
                        size={16}
                        className={
                          isSelected ? "text-blue-600" : "text-gray-400"
                        }
                        aria-hidden="true"
                      />
                      <span className="flex-1">
                        {highlightMatch(option.label, searchTerm)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-gray-500">
                <MapPin
                  size={32}
                  className="mx-auto mb-2 text-gray-300"
                  aria-hidden="true"
                />
                <p className="font-medium">
                  {searchTerm ? "No results found" : noOptionsMessage}
                </p>
                {searchTerm && (
                  <p className="text-sm text-gray-400 mt-1">
                    Try a different search term
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isOpen && loading && (
          <div
            className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-300 rounded-md mt-1 shadow-lg"
            role="status"
          >
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#16305B] mx-auto mb-2" />
              <p>Loading options...</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          id={`${fieldId}-error`}
          className="text-red-500 text-sm mt-2 flex items-center gap-2"
          role="alert"
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default LocationDropdown;
