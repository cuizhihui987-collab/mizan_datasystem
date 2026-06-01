"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface ComboboxOption {
  label: string;
  value: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  allowCustom?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "选择或输入...",
  emptyText = "未找到匹配项",
  allowCustom = true,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchText, setSearchText] = React.useState(value || "");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setSearchText(value || "");
  }, [value]);

  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchText.toLowerCase())
  );

  const selectedLabel = options.find((opt) => opt.value === value)?.label || value;

  const handleSelect = (optionValue: string, optionLabel: string) => {
    onChange(optionValue);
    setSearchText(optionLabel);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setSearchText(newText);
    if (allowCustom) {
      onChange(newText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && allowCustom) {
      if (filteredOptions.length > 0) {
        const first = filteredOptions[0];
        onChange(first.value);
        setSearchText(first.label);
      }
      setOpen(false);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
    if (e.key === "ArrowDown" && listRef.current) {
      e.preventDefault();
      const firstItem = listRef.current.querySelector<HTMLButtonElement>(
        "[data-combobox-item]"
      );
      firstItem?.focus();
    }
  };

  const handleClear = () => {
    onChange("");
    setSearchText("");
    inputRef.current?.focus();
  };

  const displayText = open ? searchText : selectedLabel || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayText}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="hover:bg-muted rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Input
            ref={inputRef}
            value={searchText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入或搜索..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
          />
        </div>
        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                data-combobox-item
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2",
                  opt.value === value && "bg-accent/50"
                )}
                onClick={() => handleSelect(opt.value, opt.label)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = e.currentTarget.nextElementSibling as HTMLButtonElement | null;
                    next?.focus();
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    const prev = e.currentTarget.previousElementSibling as HTMLButtonElement | null;
                    prev?.focus();
                  }
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    opt.value === value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="truncate">{opt.label}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-6 text-sm text-muted-foreground text-center">
              {emptyText}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
