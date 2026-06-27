type EvalAILogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const SIZE = {
  sm: { mark: 32, word: "text-lg", gap: "gap-2.5" },
  md: { mark: 36, word: "text-xl", gap: "gap-3" },
  lg: { mark: 44, word: "text-2xl", gap: "gap-3" },
} as const;

function LogoMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="4"
        width="22"
        height="28"
        rx="3"
        fill="white"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-border"
      />
      <path
        d="M24 4v4a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
      <path
        d="M10 14h14M10 18h10M10 22h12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="text-muted-foreground/60"
      />
      <rect
        x="22"
        y="24"
        width="14"
        height="14"
        rx="4"
        className="fill-primary"
      />
      <path
        d="M29 27.5v7M25.5 31h7"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoWordmark({ textClass }: { textClass: string }) {
  return (
    <span
      className={`${textClass} flex items-baseline font-bold leading-none tracking-tight`}
    >
      <span className="text-foreground">Eval</span>
      <span className="text-primary">AI</span>
    </span>
  );
}

export default function EvalAILogo({
  className = "",
  size = "md",
}: EvalAILogoProps) {
  const { mark, word, gap } = SIZE[size];

  return (
    <div
      className={`inline-flex items-center ${gap} ${className}`}
      role="img"
      aria-label="EvalAI"
    >
      <LogoMark size={mark} />
      <LogoWordmark textClass={word} />
    </div>
  );
}
