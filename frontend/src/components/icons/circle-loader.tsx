type LoaderSize = "xs" | "s" | "m" | "lg" | "xl";

const SIZE_CLASS: Record<LoaderSize, string> = {
  xs: "h-4 w-4 border-2",
  s: "h-6 w-6 border-2",
  m: "h-8 w-8 border-[3px]",
  lg: "h-10 w-10 border-[3px]",
  xl: "h-12 w-12 border-4",
};

export default function CircleLoader({
  className = "",
  size = "s",
  inline = false,
}: {
  className?: string;
  size?: LoaderSize;
  inline?: boolean;
}) {
  return (
    <span role="status" aria-label="불러오는 중" className={`loading-spinner ${inline ? "inline-flex shrink-0 align-middle" : "flex min-h-24 w-full"} items-center justify-center ${className}`}>
      <span
        aria-hidden="true"
        className={`${SIZE_CLASS[size]} animate-spin rounded-full border-current/20 border-t-current motion-reduce:animate-none`}
      />
    </span>
  );
}
