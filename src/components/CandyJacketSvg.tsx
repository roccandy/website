import type { CandyDesign } from "@/lib/candyDesign";
import {
  jacketGeometry,
  jacketBodyPath,
  JACKET_CX as CX,
  JACKET_CY as CY,
  JACKET_R as R,
} from "@/lib/candyJacketGeometry";

export function CandyJacketSvg({
  design,
  prefix,
  flat = false,
}: {
  design: CandyDesign;
  prefix: string;
  flat?: boolean;
}) {
  const geometry = jacketGeometry(design),
    a = design.jacket.advanced!;
  return (
    <g data-advanced-jacket={a.segments}>
      <defs>
        <linearGradient id={`${prefix}-body-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.28 * a.shading} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#28143c" stopOpacity={0.38 * a.shading} />
        </linearGradient>
        <clipPath id={`${prefix}-jacket`}>
          {!flat && <path d={jacketBodyPath()} />}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d={`M${CX - R} ${CY}a${R} ${R} 0 1 0 ${R * 2} 0a${R} ${R} 0 1 0 ${-R * 2} 0 M${CX - geometry.inner} ${CY}a${geometry.inner} ${geometry.inner} 0 1 0 ${geometry.inner * 2} 0a${geometry.inner} ${geometry.inner} 0 1 0 ${-geometry.inner * 2} 0`}
          />
        </clipPath>
      </defs>
      {!flat && (
        <>
          {a.shadow && (
            <ellipse
              data-candy-shadow="true"
              cx="900"
              cy="1120"
              rx="685"
              ry="85"
              fill="#b4b4b4"
              opacity="0.28"
              transform="rotate(-8 900 1120)"
            />
          )}
          {geometry.body.map((band, i) => (
            <path
              key={i}
              data-jacket-body={i}
              d={band.d}
              fill={band.colour}
              stroke={band.colour}
              strokeWidth="0.7"
            />
          ))}
          <path
            d={jacketBodyPath()}
            fill={`url(#${prefix}-body-shade)`}
            pointerEvents="none"
          />
        </>
      )}
      <circle cx={CX} cy={CY} r={geometry.inner} fill={design.jacket.fill} />
      {geometry.ring.map((band, i) => (
        <path
          key={i}
          data-jacket-ring={i}
          d={band.d}
          fill={band.colour}
          stroke={band.colour}
          strokeWidth="0.7"
        />
      ))}
      <circle
        cx={CX}
        cy={CY}
        r={geometry.inner}
        fill="none"
        stroke="#dcdcdc"
        strokeOpacity="0.5"
        strokeWidth="4.18"
      />
    </g>
  );
}
