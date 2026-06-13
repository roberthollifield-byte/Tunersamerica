import { useEffect, useRef, useState } from "react";

import img1 from "@/assets/hero-slideshow/IMG_3230.jpg";
import img3 from "@/assets/hero-slideshow/IMG_2839.jpg";
import img4 from "@/assets/hero-slideshow/IMG_2816.jpg";
import img5 from "@/assets/hero-slideshow/IMG_2784.jpg";
import vid1 from "@/assets/hero-slideshow/clip1.mp4";
import vid2 from "@/assets/hero-slideshow/clip2.mp4";

type Slide =
  | { kind: "image"; src: string; alt: string }
  | { kind: "video"; src: string; alt: string };

// Interleave images and videos for visual variety.
const SLIDES: Slide[] = [
  { kind: "image", src: img1, alt: "Tuned build" },
  { kind: "video", src: vid1, alt: "Build clip" },
  { kind: "image", src: img3, alt: "Tuned build" },
  { kind: "video", src: vid2, alt: "Build clip" },
  { kind: "image", src: img4, alt: "Tuned build" },
  { kind: "image", src: img5, alt: "Tuned build" },
];

const IMAGE_SLIDE_MS = 3500;

export function HeroSlideshow() {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const current = SLIDES[index];

  // Advance images on a timer; videos advance when they finish playing (see onEnded).
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (current.kind === "image") {
      timerRef.current = window.setTimeout(() => {
        setIndex((i) => (i + 1) % SLIDES.length);
      }, IMAGE_SLIDE_MS);
    }
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [index, current.kind]);

  // Restart the active video from the beginning so the full clip plays each rotation.
  useEffect(() => {
    if (current.kind !== "video") return;
    const v = videoRefs.current[index];
    if (!v) return;
    try {
      v.currentTime = 0;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      // ignore autoplay errors
    }
  }, [index, current.kind]);

  return (
    <div
      className="relative h-56 w-full overflow-hidden rounded-2xl border border-card-border bg-muted md:h-64"
      data-testid="hero-slideshow"
    >
      {SLIDES.map((s, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={i !== index}
        >
          {s.kind === "image" ? (
            <img
              src={s.src}
              alt={s.alt}
              className="h-full w-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
          ) : (
            <video
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              src={s.src}
              className="h-full w-full object-cover"
              muted
              playsInline
              autoPlay={i === index}
              preload="metadata"
              onEnded={() => {
                if (i === index) setIndex((idx) => (idx + 1) % SLIDES.length);
              }}
            />
          )}
        </div>
      ))}

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
            }`}
            aria-label={`Show slide ${i + 1}`}
            data-testid={`slideshow-dot-${i}`}
          />
        ))}
      </div>
    </div>
  );
}
