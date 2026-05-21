import { TIconProps } from "@/shared/icons/icon.types";

export function LogoIcon({ size = 28, className, ...rest }: TIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <rect width="32" height="32" rx="9" fill="#081a12" />
      <path
        d="M9.5 19.5C8.119 19.5 7 18.381 7 17C7 15.7355 7.943 14.6915 9.165 14.5215C9.6125 12.5125 11.434 11 13.6 11C15.7095 11 17.491 12.421 18.014 14.353C18.18 14.34 18.348 14.333 18.518 14.333C20.6685 14.333 22.412 16.0765 22.412 18.227C22.412 20.3775 20.6685 22.121 18.518 22.121H9.5"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.5" cy="11" r="1.5" fill="#7bcba9" />
    </svg>
  );
}
