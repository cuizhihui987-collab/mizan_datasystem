"use client";

import { useState, useEffect } from "react";
import { Rocket } from "lucide-react";
import { cn } from "@mizan/shared-lib/utils";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById("main-scroll-container");
    if (!el) return;
    const onScroll = () => {
      setVisible(el.scrollTop > 300);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const el = document.getElementById("main-scroll-container");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-primary/90 hover:shadow-xl",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
      aria-label="回顶部"
    >
      <Rocket className="h-5 w-5" />
    </button>
  );
}
