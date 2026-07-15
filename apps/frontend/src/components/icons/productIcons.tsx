type IconProps = { className?: string };

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function AirpodsIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <rect x="6" y="3" width="5" height="7" rx="2.5" />
      <path d="M8.5 10v6a2 2 0 1 0 4 0" />
      <rect x="13" y="3" width="5" height="7" rx="2.5" />
      <path d="M15.5 10v8a2 2 0 1 0 4 0" />
    </svg>
  );
}

function CatIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M6 8 4 3l4 3" />
      <path d="M18 8l2-5-4 3" />
      <circle cx="12" cy="13" r="7" />
      <circle cx="9.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="14.5" cy="12" r="0.5" fill="currentColor" />
      <path d="M12 14.5v1" />
      <path d="M9 17c1 1 5 1 6 0" />
    </svg>
  );
}

function DogIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M5 7c-1.5 0-2.5 2-2 5l2 3" />
      <path d="M19 7c1.5 0 2.5 2 2 5l-2 3" />
      <circle cx="12" cy="13" r="7" />
      <circle cx="9.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="14.5" cy="12" r="0.5" fill="currentColor" />
      <ellipse cx="12" cy="15" rx="1.5" ry="1" fill="currentColor" />
      <path d="M9.5 18c1 .8 3.5 .8 5 0" />
    </svg>
  );
}

function BearIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="13" r="7" />
      <circle cx="9.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="14.5" cy="12" r="0.5" fill="currentColor" />
      <circle cx="12" cy="15" r="1.6" />
      <path d="M12 16.6v0.4" />
    </svg>
  );
}

function AstronautIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5" />
      <path d="M8 9.5c1-1 6-1 8 0" />
      <path d="M6.5 15.5l-2 2" />
      <path d="M17.5 15.5l2 2" />
    </svg>
  );
}

function CarIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M4 15l1.5-4.5A2 2 0 0 1 7.4 9h9.2a2 2 0 0 1 1.9 1.5L20 15" />
      <path d="M3.5 15h17v2.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V15Z" />
      <circle cx="7.5" cy="18.5" r="1.6" />
      <circle cx="16.5" cy="18.5" r="1.6" />
    </svg>
  );
}

function FlowerIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="6.5" r="3" />
      <circle cx="12" cy="17.5" r="3" />
      <circle cx="6.5" cy="12" r="3" />
      <circle cx="17.5" cy="12" r="3" />
      <path d="M12 20v2" />
    </svg>
  );
}

function StarIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M12 3l2.6 5.8 6.2.6-4.7 4.2 1.4 6.2L12 16.9 6.5 19.8l1.4-6.2-4.7-4.2 6.2-.6L12 3Z" />
    </svg>
  );
}

function GlobeIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.5 2.2 2.5 13.8 0 16" />
      <path d="M12 4c-2.5 2.2-2.5 13.8 0 16" />
      <path d="M5.5 7.5c3.5 1.6 9.5 1.6 13 0" />
      <path d="M5.5 16.5c3.5-1.6 9.5-1.6 13 0" />
    </svg>
  );
}

function CameraIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M9 5l-1.2 2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2.8L15 5H9Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function SoccerBallIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5l3 2.2-1.1 3.5H10.1L9 10.7 12 8.5Z" />
      <path d="M12 8.5V5" />
      <path d="M15 10.7l3-1" />
      <path d="M13.9 14.2l1.9 2.8" />
      <path d="M10.1 14.2l-1.9 2.8" />
      <path d="M9 10.7l-3-1" />
    </svg>
  );
}

function BookIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M4 5.5A2 2 0 0 1 6 4h5v16H6a2 2 0 0 1-2-2V5.5Z" />
      <path d="M20 5.5A2 2 0 0 0 18 4h-5v16h5a2 2 0 0 0 2-2V5.5Z" />
      <path d="M11 4v16" />
    </svg>
  );
}

function CoffeeCupIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" />
      <path d="M16 10.5h1.5a2.2 2.2 0 0 1 0 4.4H16" />
      <path d="M8 5c0 .8.9.8.9 1.6S8 8 8 8" />
      <path d="M11.5 5c0 .8.9.8.9 1.6S11.5 8 11.5 8" />
    </svg>
  );
}

function BicycleIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="6" cy="16" r="3.2" />
      <circle cx="18" cy="16" r="3.2" />
      <path d="M6 16l4-8h4l3 8" />
      <path d="M10 8H8" />
      <path d="M10 8l3.5 8" />
      <path d="M14 8h2.5" />
    </svg>
  );
}

function RocketIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <path d="M12 3c2.8 2 4.2 5.2 4.2 8.8 0 1.7-.3 3.3-.9 4.7h-6.6c-.6-1.4-.9-3-.9-4.7C7.8 8.2 9.2 5 12 3Z" />
      <circle cx="12" cy="10" r="1.6" />
      <path d="M9.3 16.5 7 20l3-1.2" />
      <path d="M14.7 16.5 17 20l-3-1.2" />
      <path d="M10 20.5h4" />
    </svg>
  );
}

function KeyringIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} {...STROKE_PROPS}>
      <circle cx="9" cy="8" r="4" />
      <path d="M9 12v2" />
      <rect x="6.5" y="14" width="5" height="6" rx="1.5" />
    </svg>
  );
}

/**
 * Keyed by the seed data's `subject` tag (packages/db/prisma/seed.ts SUBJECTS).
 * "기본" is the fallback used when a product's tags don't match any subject.
 */
export const PRODUCT_ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  에어팟: AirpodsIcon,
  고양이: CatIcon,
  강아지: DogIcon,
  곰돌이: BearIcon,
  우주비행사: AstronautIcon,
  자동차: CarIcon,
  꽃: FlowerIcon,
  별: StarIcon,
  지구본: GlobeIcon,
  카메라: CameraIcon,
  축구공: SoccerBallIcon,
  책: BookIcon,
  커피컵: CoffeeCupIcon,
  자전거: BicycleIcon,
  로켓: RocketIcon,
  기본: KeyringIcon,
};
