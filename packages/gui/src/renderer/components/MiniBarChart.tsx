interface MiniBarChartProps {
  history: number[];
  maxValue: number;
  maxBars: number;
  style?: React.CSSProperties;
}

const STOPS: [number, number, number][] = [
  [59, 130, 246],   // blue
  [234, 179, 8],    // yellow
  [239, 68, 68],    // red
];

export function barColor(ratio: number): string {
  const t = Math.min(Math.max(ratio, 0), 1) * (STOPS.length - 1);
  const i = Math.min(Math.floor(t), STOPS.length - 2);
  const f = t - i;
  const [r1, g1, b1] = STOPS[i];
  const [r2, g2, b2] = STOPS[i + 1];
  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);
  return `rgb(${r},${g},${b})`;
}

export function barGradient(ratio: number): string {
  // Build gradient stops from blue(0%) through to the bar's color at its ratio
  const stopPositions = [0, 0.5, 1];
  const colors: string[] = [];
  for (let i = 0; i < STOPS.length; i++) {
    if (stopPositions[i] > ratio) break;
    const pct = ratio > 0 ? Math.round((stopPositions[i] / ratio) * 100) : 0;
    colors.push(`${barColor(stopPositions[i])} ${pct}%`);
  }
  // Always end with the bar's actual color at 100%
  colors.push(`${barColor(ratio)} 100%`);
  return `linear-gradient(to top, ${colors.join(', ')})`;
}

export const DOT_SIZE = 2;
export const DOT_GAP = 1;
export const COL_GAP = 2;
export const DOT_ROWS = 7;

export function MiniBarChart({ history, maxValue, maxBars, style }: MiniBarChartProps) {
  const colWidth = DOT_SIZE;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', flexDirection: 'row-reverse', justifyContent: 'flex-start', gap: COL_GAP, ...style }}>
      {history.slice().reverse().map((val, i) => {
        const ratio = Math.min(Math.max(val / maxValue, 0), 1);
        const litDots = Math.max(ratio > 0 ? 1 : 0, Math.round(ratio * DOT_ROWS));
        return (
          <div
            key={i}
            style={{
              width: colWidth,
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: DOT_GAP,
              flexShrink: 0,
            }}
          >
            {Array.from({ length: litDots }, (_, d) => (
              <div
                key={d}
                style={{
                  width: DOT_SIZE,
                  height: DOT_SIZE,
                  backgroundColor: barColor((d + 1) / DOT_ROWS),
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
