"use client";

import { useState } from "react";

export function ProductGallery({ images, alt }: { images: string[]; alt: string }): JSX.Element {
  const [selected, setSelected] = useState(0);
  const main = images[selected] ?? images[0];
  return (
    <div className="flex gap-3">
      <div className="flex w-12 shrink-0 flex-col gap-2">
        {images.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            aria-label={`사진 ${i + 1}`}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            className={`h-12 w-12 overflow-hidden rounded border-2 ${
              i === selected ? "border-primary-500" : "border-transparent hover:border-stone-300"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={main} alt={alt} className="aspect-square w-full min-w-0 flex-1 rounded-lg bg-stone-100 object-cover" />
    </div>
  );
}
