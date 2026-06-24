type EvalAILogoProps = {
  className?: string;
  showName?: boolean;
  size?: "sm" | "md";
  variant?: "light" | "dark";
};

export default function EvalAILogo({
  className = "",
  showName = true,
  size = "md",
  variant = "light",
}: EvalAILogoProps) {
  const iconSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const svgSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "sm" ? "text-sm" : "text-base";

  const isLight = variant === "light";

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className={`flex ${iconSize} items-center justify-center rounded-xl ${
          isLight ? "bg-violet-600 shadow-sm" : "bg-white/10 ring-1 ring-white/20"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${svgSize} text-white`}
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
      {showName && (
        <span
          className={`${textSize} font-semibold uppercase tracking-widest ${
            isLight ? "text-zinc-500" : "text-white"
          }`}
        >
          EvalAI
        </span>
      )}
    </div>
  );
}
