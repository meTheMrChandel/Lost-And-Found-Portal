"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const CAMPUS_SLIDES = [
  {
    src: "/campus/iit_ropar_main_gate.jpg",
    alt: "IIT Ropar Iconic Main Campus Gate",
    caption: "Main Gate • Permanent Campus",
  },
  {
    src: "/campus/iit_ropar_spiral.jpg",
    alt: "IIT Ropar Spiral Architecture Landmark",
    caption: "Academic Complex Landmark",
  },
  {
    src: "/campus/iit_ropar_transit.jpg",
    alt: "IIT Ropar Academic Building Complex",
    caption: "Department Buildings & Greenery",
  },
];

export default function CampusHeroSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % CAMPUS_SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-[380px] sm:h-[480px] lg:h-[520px] rounded-3xl overflow-hidden shadow-xl border border-[#EFEAE0]">
      {/* Background Slides */}
      {CAMPUS_SLIDES.map((slide, index) => (
        <div
          key={slide.src}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === current ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={index === 0}
            className="object-cover object-center transform scale-105 transition-transform duration-[8000ms] ease-out"
          />
          {/* Aesthetic Dual Gradient Overlay - Dark Charcoal into warm cream tints */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1C1E]/90 via-[#1C1C1E]/40 to-transparent" />
          <div className="absolute inset-0 bg-[#047857]/15 mix-blend-multiply" />
        </div>
      ))}

      {/* Floating Content on the Slider */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end p-6 sm:p-12 text-white">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-semibold mb-4 border border-white/20">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            IIT Ropar Campus Portal
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-bold leading-tight drop-shadow-md text-white mb-3">
            Lost something on campus? We&apos;ll help you find it.
          </h2>
          <p className="font-sans text-sm sm:text-base text-gray-200 drop-shadow mb-6 max-w-xl">
            Real-time feed, admin-verified handovers, and privacy-first QR tags connecting 3,000+ students and faculty across Rupnagar campus.
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href="/report-lost"
              className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#D94F3B] hover:bg-[#c24230] shadow-md transition-all transform hover:-translate-y-0.5"
            >
              Report Lost Item
            </a>
            <a
              href="/report-found"
              className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#047857] hover:bg-[#10B981] shadow-md transition-all transform hover:-translate-y-0.5"
            >
              Report Found Item
            </a>
            <a
              href="/feed"
              className="px-6 py-3 rounded-full text-sm font-semibold text-[#1C1C1E] bg-[#FAF7F2] hover:bg-white shadow-md transition-all"
            >
              Explore Feed
            </a>
          </div>
        </div>

        {/* Carousel Indicators & Caption */}
        <div className="mt-8 flex items-center justify-between border-t border-white/20 pt-4">
          <span className="text-xs font-mono text-gray-300">
            {CAMPUS_SLIDES[current].caption}
          </span>
          <div className="flex gap-2">
            {CAMPUS_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === current ? "w-8 bg-[#10B981]" : "w-2 bg-white/50 hover:bg-white"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
