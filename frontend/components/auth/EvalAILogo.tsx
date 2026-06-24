type EvalAILogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  interactive?: boolean;
};

const SIZE = {
  sm: { mark: 32, word: "text-base", gap: "gap-2" },
  md: { mark: 40, word: "text-xl", gap: "gap-2.5" },
  lg: { mark: 48, word: "text-2xl", gap: "gap-3" },
} as const;

function LogoMark({
  size,
  id,
  variant,
  interactive,
}: {
  size: number;
  id: string;
  variant: "light" | "dark";
  interactive: boolean;
}) {
  const lineColor = variant === "dark" ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.2)";
  const docFill = variant === "dark" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.9)";
  const docStroke = variant === "dark" ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.1)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={interactive ? "logo-mark-interactive" : undefined}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-brand`} x1="6" y1="42" x2="42" y2="6">
          <stop stopColor="#6366f1">
            {interactive && (
              <animate
                attributeName="stop-color"
                values="#6366f1;#a78bfa;#22d3ee;#6366f1"
                dur="5.5s"
                repeatCount="indefinite"
              />
            )}
          </stop>
          <stop offset="0.5" stopColor="#8b5cf6">
            {interactive && (
              <animate
                attributeName="stop-color"
                values="#8b5cf6;#22d3ee;#6366f1;#8b5cf6"
                dur="5.5s"
                repeatCount="indefinite"
              />
            )}
          </stop>
          <stop offset="1" stopColor="#22d3ee">
            {interactive && (
              <animate
                attributeName="stop-color"
                values="#22d3ee;#6366f1;#a78bfa;#22d3ee"
                dur="5.5s"
                repeatCount="indefinite"
              />
            )}
          </stop>
        </linearGradient>
        <radialGradient id={`${id}-orb`} cx="50%" cy="50%" r="50%">
          <stop stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0.2" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={`${id}-doc-clip`}>
          <path d="M11 9.5h17.5a2 2 0 0 1 2 2v22.5a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V11.5a2 2 0 0 1 2-2z" />
        </clipPath>
      </defs>

      {/* Document sheet */}
      <g className={interactive ? "logo-doc-group" : undefined}>
        <path
          d="M11 9.5h17.5a2 2 0 0 1 2 2v22.5a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V11.5a2 2 0 0 1 2-2z"
          fill={docFill}
          stroke={docStroke}
          strokeWidth="1"
        />
        {/* Folded corner */}
        <path
          d="M28.5 9.5V11.5a2 2 0 0 0 2 2h2"
          stroke={`url(#${id}-brand)`}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={variant === "dark" ? 0.7 : 0.5}
        />
        <path
          d="M13.5 16h14M13.5 20h10.5M13.5 24h12.5M13.5 28h8"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* AI scan beam across document */}
        <g clipPath={`url(#${id}-doc-clip)`}>
          <rect
            x="9"
            y="14"
            width="22"
            height="2"
            fill={`url(#${id}-brand)`}
            opacity={variant === "dark" ? 0.35 : 0.25}
            className={interactive ? "logo-scan-beam" : undefined}
          >
            {interactive && (
              <animate
                attributeName="y"
                values="12;34;12"
                dur="3.2s"
                repeatCount="indefinite"
              />
            )}
          </rect>
        </g>
      </g>

      {/* AI neural cluster — overlaps document */}
      <g filter={`url(#${id}-glow)`} className={interactive ? "logo-ai-cluster" : undefined}>
        {/* Connection lines */}
        <path
          d="M33 33.5 36.5 30M33 33.5 29.5 30M33 33.5 33 37.5"
          stroke={`url(#${id}-brand)`}
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity={0.75}
        />
        {/* Satellite nodes */}
        <circle cx="36.5" cy="30" r="1.8" fill={`url(#${id}-brand)`}>
          {interactive && (
            <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
          )}
        </circle>
        <circle cx="29.5" cy="30" r="1.8" fill={`url(#${id}-brand)`}>
          {interactive && (
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="2s"
              begin="0.4s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        <circle cx="33" cy="37.5" r="1.8" fill={`url(#${id}-brand)`}>
          {interactive && (
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="2s"
              begin="0.8s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        {/* Core AI orb */}
        <circle
          cx="33"
          cy="33.5"
          r="4.2"
          fill={`url(#${id}-orb)`}
          stroke={`url(#${id}-brand)`}
          strokeWidth="1.4"
          className={interactive ? "logo-ai-core" : undefined}
        >
          {interactive && (
            <animate attributeName="r" values="3.9;4.5;3.9" dur="2.8s" repeatCount="indefinite" />
          )}
        </circle>
        {/* Spark inside orb */}
        <path
          d="M33 31.2v4.6M31.2 33.5h3.6"
          stroke="white"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity={variant === "dark" ? 0.9 : 0.7}
        />
      </g>
    </svg>
  );
}

function LogoWordmark({
  variant,
  textClass,
  interactive,
}: {
  variant: "light" | "dark";
  textClass: string;
  interactive: boolean;
}) {
  const evalColor = variant === "dark" ? "text-white" : "text-slate-900";

  return (
    <span
      className={`${textClass} flex items-baseline font-semibold leading-none tracking-tight`}
    >
      <span className={evalColor}>Eval</span>
      <span
        className={`logo-ai-text bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent ${
          interactive ? "logo-ai-text-shimmer" : ""
        }`}
      >
        AI
      </span>
    </span>
  );
}

export default function EvalAILogo({
  className = "",
  size = "md",
  variant = "light",
  interactive = true,
}: EvalAILogoProps) {
  const { mark, word, gap } = SIZE[size];
  const gradientId = `evalai-${variant}-${size}`;

  return (
    <div
      className={`logo-root inline-flex items-center ${gap} ${
        interactive ? "logo-root-interactive" : ""
      } ${className}`}
      role="img"
      aria-label="EvalAI"
    >
      <div className="relative flex shrink-0 items-center justify-center">
        {interactive && (
          <span
            className={`logo-glow absolute inset-0 blur-lg ${
              variant === "dark"
                ? "bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-cyan-400/15"
                : "bg-gradient-to-br from-indigo-600/15 via-violet-500/10 to-cyan-500/15"
            }`}
            aria-hidden="true"
          />
        )}
        <LogoMark
          size={mark}
          id={gradientId}
          variant={variant}
          interactive={interactive}
        />
      </div>
      <LogoWordmark variant={variant} textClass={word} interactive={interactive} />
    </div>
  );
}
