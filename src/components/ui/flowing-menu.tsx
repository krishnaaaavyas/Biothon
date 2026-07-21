import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import "./flowing-menu.css";

export interface MenuItem {
  text: string;
  image?: string;
  github: string;
  linkedin: string;
  initials: string;
}

interface FlowingMenuProps {
  items: MenuItem[];
}

export function FlowingMenu({ items }: FlowingMenuProps) {
  return (
    <div className="flowing-menu-container">
      {items.map((item, index) => (
        <FlowingMenuItem key={index} item={item} />
      ))}
    </div>
  );
}

interface FlowingMenuItemProps {
  item: MenuItem;
}

function FlowingMenuItem({ item }: FlowingMenuItemProps) {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (marqueeRef.current) {
      animationRef.current = gsap.to(marqueeRef.current, {
        xPercent: -50,
        duration: 16,
        ease: "none",
        repeat: -1,
        paused: true,
      });
    }

    return () => {
      if (animationRef.current) {
        animationRef.current.kill();
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (animationRef.current) {
      animationRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    if (animationRef.current) {
      animationRef.current.pause();
    }
  };

  return (
    <div
      className="flowing-menu-item group py-6 md:py-8"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Centered developer name */}
      <span className="flowing-menu-text text-xl sm:text-2xl md:text-3xl tracking-tight">
        {item.text}
      </span>

      {/* Hover Infinite Marquee Overlay with clickable links and avatar pills */}
      <div className="flowing-menu-marquee">
        <div ref={marqueeRef} className="flowing-menu-marquee-inner">
          {Array(8)
            .fill(null)
            .map((_, i) => (
              <React.Fragment key={i}>
                <a
                  href={item.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flowing-menu-link text-lg sm:text-xl md:text-2xl px-6"
                >
                  GitHub
                </a>
                <a
                  href={item.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flowing-menu-link text-lg sm:text-xl md:text-2xl px-6"
                >
                  LinkedIn
                </a>
              </React.Fragment>
            ))}
        </div>
      </div>
    </div>
  );
}
