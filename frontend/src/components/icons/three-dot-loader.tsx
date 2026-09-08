import { CSSProperties } from "react";

type LoaderSize = "s" | "m" | "lg" | "xl";

const SIZE_MAP: Record<LoaderSize, string> = {
  s: "24px",
  m: "32px",
  lg: "40px",
  xl: "56px",
};

export default function ThreeDotLoader({
  className,
  size = "s",
}: {
  className?: string;
  size?: LoaderSize;
}) {
  const customStyle: CSSProperties & { ["--uib-size"]?: string } = {
    "--uib-size": SIZE_MAP[size],
  };

  return (
    <div
      className={`three-dot-loader-container ui:ml-2 ui:mt-2 ${className}`}
      style={customStyle}
    >
      <div className="three-dot-loading"></div>
      <div className="three-dot-loading"></div>
      <div className="three-dot-loading"></div>
    </div>
  );
}
