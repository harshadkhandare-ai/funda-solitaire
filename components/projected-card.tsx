type Point = { x: number; y: number };
type Projection = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

// Plain SVG affine triangles render in Safari/WebView without foreignObject or CSS 3D.
export function ProjectedCard({
  id,
  projection,
}: {
  id: string;
  projection: Projection;
}) {
  const [a, b, c, d, e, f, g, h] = projection;
  const project = ({ x, y }: Point): Point => ({
    x: (a * x + b * y + c) / (g * x + h * y + 1),
    y: (d * x + e * y + f) / (g * x + h * y + 1),
  });
  const triangles: { points: string; transform: string }[] = [];
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 6; col++) {
      const x = (col * 512) / 6,
        y = (row * 768) / 8;
      const p = [
        { x, y },
        { x: x + 512 / 6, y },
        { x: x + 512 / 6, y: y + 768 / 8 },
        { x, y: y + 768 / 8 },
      ];
      for (const indices of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const [s0, s1, s2] = indices.map((i) => p[i]);
        const target = [s0, s1, s2].map(project);
        const [t0, t1, t2] = target;
        const dx1 = s1.x - s0.x,
          dx2 = s2.x - s0.x,
          dy1 = s1.y - s0.y,
          dy2 = s2.y - s0.y;
        const determinant = dx1 * dy2 - dx2 * dy1;
        const m0 = ((t1.x - t0.x) * dy2 - (t2.x - t0.x) * dy1) / determinant;
        const m2 = ((t2.x - t0.x) * dx1 - (t1.x - t0.x) * dx2) / determinant;
        const m1 = ((t1.y - t0.y) * dy2 - (t2.y - t0.y) * dy1) / determinant;
        const m3 = ((t2.y - t0.y) * dx1 - (t1.y - t0.y) * dx2) / determinant;
        const center = {
          x: (t0.x + t1.x + t2.x) / 3,
          y: (t0.y + t1.y + t2.y) / 3,
        };
        // Tiny overlap prevents antialiasing seams between neighboring triangles.
        const points = target
          .map((t) => {
            const length = Math.hypot(t.x - center.x, t.y - center.y);
            return `${t.x + ((t.x - center.x) * 0.15) / length},${t.y + ((t.y - center.y) * 0.15) / length}`;
          })
          .join(' ');
        triangles.push({
          points,
          transform: `matrix(${m0} ${m1} ${m2} ${m3} ${t0.x - m0 * s0.x - m2 * s0.y} ${t0.y - m1 * s0.x - m3 * s0.y})`,
        });
      }
    }
  return (
    <g>
      <defs>
        <image
          id={`${id}-texture`}
          href="/cards/back.png"
          width="512"
          height="768"
          preserveAspectRatio="none"
        />
        {triangles.map((triangle, index) => (
          <clipPath
            key={index}
            id={`${id}-${index}`}
            clipPathUnits="userSpaceOnUse"
          >
            <polygon points={triangle.points} />
          </clipPath>
        ))}
      </defs>
      {triangles.map((triangle, index) => (
        <g key={index} clipPath={`url(#${id}-${index})`}>
          <use href={`#${id}-texture`} transform={triangle.transform} />
        </g>
      ))}
    </g>
  );
}
