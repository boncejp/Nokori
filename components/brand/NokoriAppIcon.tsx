import Image from "next/image";

import { NOKORI_APP_ICON_PATH } from "@/lib/constants/brand";

type NokoriAppIconProps = Readonly<{
  size?: number;
  className?: string;
  priority?: boolean;
}>;

export function NokoriAppIcon({
  size = 56,
  className,
  priority = false,
}: NokoriAppIconProps) {
  return (
    <Image
      src={NOKORI_APP_ICON_PATH}
      alt="Nokori"
      width={size}
      height={size}
      priority={priority}
      className={className}
      sizes={`${size}px`}
    />
  );
}
