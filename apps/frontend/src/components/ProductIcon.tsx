import { PRODUCT_ICONS } from "./icons/productIcons";
import { DEFAULT_MATERIAL_STYLE, MATERIAL_STYLES } from "./icons/productStyles";

interface ProductIconProps {
  tags: string[];
  name: string;
  className?: string;
}

export function ProductIcon({ tags, name, className = "" }: ProductIconProps): JSX.Element {
  const subjectTag = tags.find((tag) => tag in PRODUCT_ICONS);
  const materialTag = tags.find((tag) => tag in MATERIAL_STYLES);
  const Icon = PRODUCT_ICONS[subjectTag ?? "기본"];
  const styleClass = materialTag ? MATERIAL_STYLES[materialTag] : DEFAULT_MATERIAL_STYLE;

  return (
    <div
      className={`flex items-center justify-center rounded-2xl ${styleClass} ${className}`}
      role="img"
      aria-label={name}
    >
      <Icon className="h-1/2 w-1/2" />
    </div>
  );
}
