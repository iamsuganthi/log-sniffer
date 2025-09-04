interface SnykLogoProps {
  className?: string;
  size?: number;
}

export default function SnykLogo({ className = "", size = 24 }: SnykLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* General Shield Shape */}
      <path
        d="M12 2L20 6V16L12 26L4 16V6L12 2Z"
        fill="currentColor"
        stroke="none"
      />
      
      {/* Inner shield detail */}
      <path
        d="M12 4L18 7V15L12 23L6 15V7L12 4Z"
        fill="white"
        fillOpacity="0.9"
      />
      
      {/* Security emblem */}
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="currentColor"
      />
      
      {/* Inner security symbol */}
      <path
        d="M10 12L11.5 13.5L14 10.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}