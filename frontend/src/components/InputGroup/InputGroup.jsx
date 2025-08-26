import { cn } from "../../lib/utils";
import { useId } from "react";
import React, { useState, forwardRef, useEffect, useRef } from "react";
import PhoneInput from "react-country-phone-input";
import "react-country-phone-input/lib/plain.css";

/**
 * A reusable input group component with support for various input types
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS classes for the container
 * @param {string} props.label - Label text for the input
 * @param {string} [props.type] - Input type (phone, dropdown, or standard input)
 * @param {string} [props.placeholder] - Placeholder text for the input
 * @param {boolean} [props.required] - Whether the input is required
 * @param {boolean} [props.disabled] - Whether the input is disabled
 * @param {boolean} [props.active] - Whether the input is active
 * @param {Function} [props.onChange] - Change event handler
 * @param {React.ReactNode} [props.icon] - Icon element to display
 * @param {string} [props.fileStyleVariant] - Style variant for file inputs
 * @param {string} [props.name] - Input name attribute
 * @param {string} [props.iconPosition] - Position of the icon (left or right)
 * @param {string} [props.height] - Height variant (e.g., sm)
 * @param {string} [props.value] - Controlled input value
 * @param {boolean} [props.error] - Whether to show error styling
 * @param {string} [props.defaultValue] - Default input value
 * @param {React.ReactNode} [props.children] - Children elements (for dropdown)
 * @param {{label: string, value: string}[]} [props.options] - Options for multiselect
 * @returns {JSX.Element} Input group component
 * @author Sanjaykumar Ramachandran
 */
const InputGroup = forwardRef(({
  className,
  label,
  type,
  placeholder,
  required,
  disabled,
  active,
  onChange,
  icon,
  fileStyleVariant,
  name,
  iconPosition,
  height,
  value,
  error,
  defaultValue,
  children,
  checked,
  background,
  withIcon,
  backgroundSize,
  min,
  step,
  inputStyles,
  accept,
  maxLength,
  options,
}, ref) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  
  useEffect(() => {
    const onDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Function to render the correct input based on type
  const renderInput = () => {
    switch (type) {
      case "phone":
        return (
          <PhoneInput
            country={"gb"}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            containerClass="!h-full !rounded-lg"
            inputClass={cn(
              " !w-full !font-outfit !text-base !border-[1.5px] !bg-transparent !border-neutral-300 !py-6 !px-14 rounded-lg focus:!border-primary-500 dark:!bg-dark-2 dark:!border-dark-3",
              error ? "!border-[1.5px] !border-red animate-pulse" : ""
            )}
            buttonClass="!p-1 !my-1 !border-[0px] !border-r-1 !border-neutral-300 dark:!border-dark-3 !bg-transparent !rounded-l-lg"
            dropdownClass="!rounded-lg  dark:!bg-dark-3 dark:!border-dark-4"
          />
        );
      case "toggleswitch":
        return (
          <label
            htmlFor={id}
            className="flex max-w-fit cursor-pointer select-none items-center"
          >
            <div className="relative">
              <input
                type="checkbox"
                checked={checked}
                name={name}
                id={id}
                onChange={onChange}
                className="peer sr-only"
              />
              <div
                className={cn(
                  "h-6 w-11 peer-checked:bg-primary-600/40  transition-colors rounded-full bg-gray-3 dark:bg-[#5A616B]",
                  {
                    "h-5": backgroundSize === "sm",
                    "bg-[#212B36] dark:bg-primary": background === "dark",
                  }
                )}
              />

              <div
                className={cn(
                  "absolute top-1 left-1 flex size-4 items-center justify-center rounded-full bg-white shadow-switch-1 transition-all duration-300 peer-checked:translate-x-5 peer-checked:[&_.check-icon]:block peer-checked:[&_.x-icon]:hidden",
                  {
                    "-top-1 left-0 size-7 shadow-switch-2":
                      backgroundSize === "sm",
                    "peer-checked:dark:bg-white": background !== "dark",
                  }
                )}
              >
                {withIcon && (
                  <>
                    {/* <CheckIcon className="check-icon hidden fill-white dark:fill-dark" />
                            <XIcon className="x-icon" /> */}
                  </>
                )}
              </div>
            </div>
          </label>
        );
      case "textarea":
        return (
          <textarea
            id={id}
            type={type}
            name={name}
            placeholder={placeholder}
            onChange={onChange}
            value={value}
            required={required}
            disabled={disabled}
            data-active={active}
            defaultValue={defaultValue}
            className={cn(
              "w-full rounded-lg border-[1.5px] border-neutral-300 bg-transparent outline-none transition focus:border-primary-500 disabled:cursor-default disabled:bg-gray-2 data-[active=true]:border-primary-500 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary-500 dark:disabled:bg-dark dark:data-[active=true]:border-primary-500",
              "px-5.5 py-3.5  placeholder:text-dark-6 dark:text-white resize-y",
              iconPosition === "left" && "pl-12.5",
              height === "sm" && "py-2.5",
              error ? "border-[1.5px] border-red animate-pulse" : ""
            )}
          />
        );
      case "dropdown":
        return (
          <select
            id={id}
            type={type}
            name={name}
            placeholder={placeholder}
            onChange={onChange}
            value={value}
            required={required}
            disabled={disabled}
            data-active={active}
            defaultValue={defaultValue}
            className={cn(
              "w-full rounded-lg border-[1.5px] border-neutral-300 bg-transparent outline-none transition focus:border-primary-500 disabled:cursor-default disabled:bg-gray-2 data-[active=true]:border-primary-500 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary-500 dark:disabled:bg-dark dark:data-[active=true]:border-primary-500",
              "px-5.5 py-3.5 placeholder:text-dark-6 dark:text-white",
              iconPosition === "left" && "pl-12.5",
              height === "sm" && "py-2.5",
              error ? "border-[1.5px] border-red animate-pulse" : ""
            )}
          >
            {children}
          </select>
        );
        case "multiselect":
          // expects: value = string[], options = [{label, value}]
          const selectedValues = Array.isArray(value) ? value : [];
          const opts = Array.isArray(options) ? options : [];

          const emitChange = (nextArr) => {
            if (onChange) onChange({ target: { name, value: nextArr } });
          };
          const toggleValue = (v) => {
            const exists = selectedValues.includes(v);
            const next = exists
              ? selectedValues.filter(x => x !== v)
              : [...selectedValues, v];
            emitChange(next);
          };
          const removeValue = (v, e) => {
            if (e) e.stopPropagation();
            emitChange(selectedValues.filter(x => x !== v));
          };
          const onKeyDown = (e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
              e.preventDefault(); setOpen(true); setActiveIndex(0); return;
            }
            if (!open) {
              if (e.key === "Backspace" && selectedValues.length) {
                emitChange(selectedValues.slice(0, -1));
              }
              return;
            }
            if (e.key === "Escape") { setOpen(false); return; }
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, opts.length - 1)); }
            if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              const opt = opts[activeIndex];
              if (opt) toggleValue(opt.value);
            }
          };

          return (
            <div ref={wrapperRef} className="relative">
              {/* Clickable field displaying tags */}
              <div
                id={id}
                role="combobox"
                aria-expanded={open}
                aria-haspopup="listbox"
                tabIndex={0}
                onClick={() => setOpen(o => !o)}
                onKeyDown={onKeyDown}
                className={cn(
                  "w-full min-h-[44px] rounded-lg border-[1.5px] border-neutral-300 bg-transparent outline-none transition",
                  "focus:border-primary-500 data-[active=true]:border-primary-500 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary-500",
                  "px-5.5 py-2.5 flex flex-wrap items-center gap-2 cursor-text",
                  iconPosition === "left" && "pl-12.5",
                  error ? "border-[1.5px] border-red animate-pulse" : ""
                )}
                data-active={active}
              >
                {selectedValues.length === 0 ? (
                  <span className="text-dark-6 dark:text-white/60">{placeholder || "Select…"}</span>
                ) : (
                  selectedValues.map(v => {
                    const o = opts.find(x => x.value === v);
                    const label = o ? o.label : v;
                    return (
                      <span
                        key={v}
                        className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-[#F5F7FA] px-2.5 py-1 text-sm text-[#111827] dark:border-dark-3 dark:bg-dark-3 dark:text-white"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={(e) => removeValue(v, e)}
                          aria-label={`Remove ${label}`}
                          className="rounded hover:opacity-80 focus:outline-none"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                )}
                {/* caret */}
                <svg className="ml-auto h-4 w-4 opacity-60 pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z" />
                </svg>
              </div>

              {/* Dropdown */}
              {open && (
                <ul
                  role="listbox"
                  aria-labelledby={id}
                  className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-dark-3 dark:bg-dark-2"
                >
                  {opts.length === 0 && (
                    <li className="px-3 py-2 text-sm text-neutral-500 dark:text-white/70">No options</li>
                  )}
                  {opts.map((o, idx) => {
                    const selected = selectedValues.includes(o.value);
                    return (
                      <li
                        key={o.value}
                        role="option"
                        aria-selected={selected}
                        onMouseDown={(e) => e.preventDefault()} // keep focus
                        onClick={() => toggleValue(o.value)}
                        className={cn(
                          "flex cursor-pointer select-none items-center justify-between px-3 py-2 text-sm",
                          "hover:bg-neutral-100 dark:hover:bg-dark-3",
                          idx === activeIndex ? "bg-neutral-50 dark:bg-dark-3" : "",
                          selected ? "font-medium" : ""
                        )}
                      >
                        <span>{o.label}</span>
                        {selected && (
                          <svg className="h-4 w-4 opacity-80" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.01 7.07a1 1 0 0 1-1.423.01L3.29 8.798a1 1 0 1 1 1.42-1.41l3.15 3.171 6.3-6.35a1 1 0 0 1 1.544.081z" clipRule="evenodd" />
                          </svg>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
      default:
        return (
          <input
            ref={ref}
            id={id}
            type={type}
            name={name}
            placeholder={placeholder}
            onChange={onChange}
            value={value}
            min={min}
            accept={accept}
            step={step}
            defaultValue={defaultValue}
            className={cn(
              "w-full rounded-lg border-[1.5px] border-neutral-300 bg-transparent outline-none transition focus:border-primary-500 disabled:cursor-default disabled:bg-gray-2 data-[active=true]:border-primary-500 dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary-500 dark:disabled:bg-dark dark:data-[active=true]:border-primary-500",
              type === "file"
                ? getFileStyles(fileStyleVariant)
                : "px-5.5 py-3 text-dark placeholder:text-dark-6 dark:text-white",
              iconPosition === "left" && "pl-12.5",
              height === "sm" && "py-2.5",
              error ? "border-[1.5px] border-red animate-pulse" : "", inputStyles
            )}
            required={required}
            disabled={disabled}
            data-active={active}
            maxLength={maxLength}
          />
        );
    }
  };

  return (
    <div className={className}>
      {/* Label with optional required indicator */}
      {label && 
        <label
          htmlFor={id}
          className="text-body-sm font-medium text-black dark:text-white"
        >
          {label}
          {required && <span className="ml-1 select-none text-red">*</span>}
        </label>
      }

      {/* Input container with icon positioning */}
      <div
        className={cn(
          "relative",
          label && "mt-3",
          "[&_svg]:absolute [&_svg]:top-1/2 [&_svg]:-translate-y-1/2",
          iconPosition === "left" ? "[&_svg]:left-4.5" : "[&_svg]:right-4.5",
        )}
      >
        {renderInput()}
        {/* Optional icon */}
        {icon}
      </div>
    </div> 
  );
});

export default InputGroup;

/**
 * Returns Tailwind CSS styles for file input based on variant
 * @param {string} variant - The style variant for file input
 * @returns {string} Tailwind CSS classes for file input styling
 * @author Sanjaykumar Ramachandran
 */
function getFileStyles(variant) {
  switch (variant) {
    case "style1":
      return "file:mr-5 file:border-collapse file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-stroke file:bg-[#E2E8F0] file:px-6.5 file:py-[13px] file:text-body-sm file:font-medium file:text-dark-5 file:hover:bg-primary-100 file:hover:bg-opacity-50 dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white";
    case "style2":
      return "file:mr-5 file:border-collapse file:cursor-pointer file:border-0 file:border-r file:border-solid file:border-stroke file:bg-[#E2E8F0] file:px-6.5 file:py-2 file:text-body-sm file:font-medium file:text-dark-5 file:hover:bg-primary-100 file:hover:bg-opacity-50 dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white";
    default:
      return "file:mr-4 file:rounded file:border-[0.5px] file:border-stroke file:bg-stroke file:px-2.5 file:py-1 file:text-body-xs file:font-medium file:text-dark-5 file:focus:border-primary-50 dark:file:border-dark-3 dark:file:bg-white/30 dark:file:text-white px-3 py-[9px]";
  }
}
