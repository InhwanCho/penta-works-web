type LoaderSize = "s" | "m" | "lg" | "xl";

const SIZE_CLASS: Record<LoaderSize, string> = {
  s: "h-6 w-6 border-2",
  m: "h-8 w-8 border-[3px]",
  lg: "h-10 w-10 border-[3px]",
  xl: "h-12 w-12 border-4",
};

export default function CircleLoader({
  className = "",
  size = "s",
}: {
  className?: string;
  size?: LoaderSize;
}) {
  return (
    <span role="status" aria-label="불러오는 중" className={`inline-flex items-center justify-center ${className}`}>
      <span
        aria-hidden="true"
        className={`${SIZE_CLASS[size]} animate-spin rounded-full border-sky-200 border-t-sky-700 motion-reduce:animate-none dark:border-sky-900 dark:border-t-sky-300`}
      />
    </span>
  );
}
