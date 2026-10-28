import Image from "next/image";

interface LogoProps {
  size?: number;
  /** "mark" is the bare magnifier for light headers; "tile" is the dark app-icon square. */
  variant?: "mark" | "tile";
  className?: string;
}

export default function Logo({ size = 40, variant = "mark", className = "" }: LogoProps) {
  return (
    <Image
      src={variant === "tile" ? "/lf-icon.svg" : "/lf-mark.svg"}
      width={size}
      height={size}
      alt="Lost & Found logo"
      className={`shrink-0 ${className}`}
    />
  );
}
