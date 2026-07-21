import React from "react";
import "./glass-icons.css";

// ── Gradient palette shared across the whole app ──────────────────────────────
export const GLASS_GRADIENTS: Record<string, string> = {
  teal: "linear-gradient(135deg, hsl(174, 75%, 45%), hsl(174, 75%, 35%))",
  purple: "linear-gradient(135deg, hsl(215, 20%, 50%), hsl(215, 20%, 40%))",
  slate: "linear-gradient(135deg, hsl(215, 20%, 50%), hsl(215, 20%, 40%))",
  red: "linear-gradient(135deg, hsl(220, 15%, 40%), hsl(220, 15%, 30%))",
  darkSlate: "linear-gradient(135deg, hsl(220, 15%, 40%), hsl(220, 15%, 30%))",
  indigo: "linear-gradient(135deg, hsl(225, 40%, 52%), hsl(225, 40%, 42%))",
  orange: "linear-gradient(135deg, hsl(220, 15%, 40%), hsl(220, 15%, 30%))",
  green: "linear-gradient(135deg, hsl(150, 45%, 45%), hsl(150, 45%, 35%))",
  emerald: "linear-gradient(135deg, hsl(150, 45%, 45%), hsl(150, 45%, 35%))",
  blue: "linear-gradient(135deg, hsl(195, 50%, 48%), hsl(195, 50%, 38%))",
  petrol: "linear-gradient(135deg, hsl(195, 50%, 48%), hsl(195, 50%, 38%))",
};

// ── Single glass icon box (inline usage) ─────────────────────────────────────
// Drop-in replacement for `div.bg-teal/10` icon containers.
// Usage:
//   <GlassIconBox color="teal" size="sm">
//     <SomeIcon className="h-4 w-4 text-foreground" />
//   </GlassIconBox>

export interface GlassIconBoxProps {
  /** Named colour key from GLASS_GRADIENTS, or any CSS colour/gradient string */
  color?: string;
  /** "xs" = 28px, "sm" = 36px (default), "md" = 48px, "lg" = 56px */
  size?: "xs" | "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
  hoverParent?: "group-hover" | "group-hover/item";
}

const SIZE_MAP: Record<NonNullable<GlassIconBoxProps["size"]>, string> = {
  xs: "w-7 h-7",
  sm: "w-9 h-9",
  md: "w-12 h-12",
  lg: "w-14 h-14",
};

export function GlassIconBox({
  color = "teal",
  size = "sm",
  children,
  className = "",
  hoverParent = "group-hover",
}: GlassIconBoxProps) {
  const gradient = GLASS_GRADIENTS[color] ?? color;
  const sizeClass = SIZE_MAP[size];

  const isXs = size === "xs";
  let backHoverClass = "";
  let frontHoverClass = "";

  if (hoverParent === "group-hover/item") {
    backHoverClass = isXs
      ? "group-hover/item:translate-x-0.5 group-hover/item:translate-y-0.5 group-hover/item:scale-100"
      : "group-hover/item:translate-x-[3px] group-hover/item:translate-y-[3px] group-hover/item:scale-[0.95]";
    frontHoverClass = isXs
      ? "group-hover/item:translate-x-0 group-hover/item:translate-y-0 group-hover/item:scale-100"
      : "group-hover/item:translate-x-[-2px] group-hover/item:translate-y-[-2px] group-hover/item:scale-[1.02]";
  } else {
    backHoverClass = isXs
      ? "group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:scale-100"
      : "group-hover:translate-x-[3px] group-hover:translate-y-[3px] group-hover:scale-[0.95]";
    frontHoverClass = isXs
      ? "group-hover:translate-x-0 group-hover:translate-y-0 group-hover:scale-100"
      : "group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] group-hover:scale-[1.02]";
  }

  return (
    <div
      className={`relative shrink-0 select-none ${sizeClass} ${className}`}
      style={{ perspective: "20rem", transformStyle: "preserve-3d" }}
      aria-hidden="true"
    >
      {/* Shadow / back layer */}
      <span
        className={`absolute inset-0 rounded-xl shadow-sm transition-all duration-300 ${backHoverClass}`}
        style={{ background: gradient }}
      />
      {/* Glass front layer */}
      <span
        className={`absolute inset-0 rounded-xl border border-border/80 flex items-center justify-center transition-all duration-300 shadow-sm ${frontHoverClass}`}
        style={{
          background: "rgba(255,255,255,0.32)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {children}
      </span>
    </div>
  );
}

// ── GlassIcons list component (unchanged) ────────────────────────────────────
const gradientMapping: Record<string, string> = GLASS_GRADIENTS;

export interface GlassIconsItem {
  icon: React.ReactNode;
  color: string;
  label: string;
  customClass?: string;
  onClick?: () => void;
}

interface GlassIconsProps {
  items: GlassIconsItem[];
  className?: string;
}

export function GlassIcons({ items, className }: GlassIconsProps) {
  const getBackgroundStyle = (color: string) => {
    if (gradientMapping[color]) {
      return { background: gradientMapping[color] };
    }
    return { background: color };
  };

  return (
    <div className={`icon-btns ${className || ""}`}>
      {items.map((item, index) => {
        const ButtonWrapper = item.onClick ? "button" : "div";
        return (
          <ButtonWrapper
            key={index}
            className={`icon-btn ${item.customClass || ""}`}
            aria-label={item.label}
            type={item.onClick ? "button" : undefined}
            onClick={item.onClick}
          >
            <span
              className="icon-btn__back"
              style={getBackgroundStyle(item.color)}
            ></span>
            <span className="icon-btn__front">
              <span className="icon-btn__icon" aria-hidden="true">
                {item.icon}
              </span>
            </span>
            <span className="icon-btn__label">{item.label}</span>
          </ButtonWrapper>
        );
      })}
    </div>
  );
}

export default GlassIcons;
