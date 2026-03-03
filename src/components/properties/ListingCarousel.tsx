"use client";

import { useEffect, useRef, useState, useEffectEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PropertyCard } from "@/types";
import { Button } from "@/components/ui/button";
import { ListingCard } from "./ListingCard";

interface ListingCarouselProps {
  properties: PropertyCard[];
}

export function ListingCarousel({ properties }: ListingCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(properties.length > 1);

  const updateScrollState = useEffectEvent(() => {
    const container = containerRef.current;

    if (!container) {
      setCanScrollLeft(false);
      setCanScrollRight(properties.length > 1);
      return;
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    setCanScrollLeft(container.scrollLeft > 8);
    setCanScrollRight(maxScrollLeft - container.scrollLeft > 8);
  });

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    updateScrollState();

    const handleScroll = () => {
      updateScrollState();
    };

    const handleResize = () => {
      updateScrollState();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [properties.length, updateScrollState]);

  const scrollByViewport = (direction: "left" | "right") => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const distance = Math.max(container.clientWidth * 0.9, 320);
    container.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Scroll listings left"
          onClick={() => scrollByViewport("left")}
          disabled={!canScrollLeft}
          className="h-11 w-11 rounded-full border-[var(--sandstone-navy)]/12 bg-white text-[var(--sandstone-navy)] hover:bg-[var(--sandstone-off-white)]"
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Scroll listings right"
          onClick={() => scrollByViewport("right")}
          disabled={!canScrollRight}
          className="h-11 w-11 rounded-full border-[var(--sandstone-navy)]/12 bg-white text-[var(--sandstone-navy)] hover:bg-[var(--sandstone-off-white)]"
        >
          <ChevronRight />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {properties.map((property, index) => (
          <div
            key={property.id}
            className="min-w-[82%] snap-start sm:min-w-[360px] lg:min-w-[380px]"
          >
            <ListingCard property={property} priority={index < 2} />
          </div>
        ))}
      </div>
    </div>
  );
}
