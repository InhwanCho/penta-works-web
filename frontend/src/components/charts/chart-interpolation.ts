/** Fill bounded gaps on a copy of the series. The set identifies estimated points for rendering. */
export function interpolateChartGaps(
  values: readonly (number | null)[],
  times: readonly (number | undefined)[],
) {
  const displayed = [...values];
  const estimated = new Set<number>();
  let index = 0;
  while (index < values.length) {
    if (values[index] !== null) {
      index++;
      continue;
    }
    const start = index;
    while (index < values.length && values[index] === null) index++;
    const before = start - 1;
    const after = index;
    const left = values[before];
    const right = values[after];
    if (after - start < 2 || left == null || right == null) continue;

    const interval = times.slice(before, after + 1);
    const orderedTimes = interval.length === after - before + 1 && interval.every(
      (time, i) => typeof time === "number" && Number.isFinite(time) && (i === 0 || time > (interval[i - 1] ?? NaN)),
    );
    for (let point = start; point < after; point++) {
      const fraction = orderedTimes
        ? (times[point]! - times[before]!) / (times[after]! - times[before]!)
        : (point - before) / (after - before);
      displayed[point] = left + (right - left) * fraction;
      estimated.add(point);
    }
  }
  return { displayed, estimated };
}
