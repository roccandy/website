"use client";

import { Sora } from "next/font/google";
import { useMemo } from "react";

type Props = {
  designText?: string;
  lineOne?: string;
  lineTwo?: string;
  showHeart?: boolean;
  mode: "" | "rainbow" | "pinstripe" | "two_colour";
  showPinstripe?: boolean;
  colorOne: string;
  colorTwo: string;
  logoUrl?: string | null;
  textColor?: string;
  heartColor?: string;
  isInitials?: boolean;
  dimensions?: { width: number; height: number };
  zoom?: number;
};

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});
const previewDimensions = { width: 350, height: 260 };
const RING_CENTER = { x: 544.367, y: 659.802 };
const RING_OUTER_R = 532;
const RING_INNER_R = 445;
const RING_STROKE_R = (RING_OUTER_R + RING_INNER_R) / 2;
const RING_STROKE_WIDTH = RING_OUTER_R - RING_INNER_R;
const CANVAS_WIDTH = 1772;
const CANVAS_HEIGHT = 1300;

export function CandyPreview({
  designText,
  lineOne,
  lineTwo,
  showHeart,
  mode,
  showPinstripe,
  colorOne,
  colorTwo,
  logoUrl,
  textColor,
  heartColor,
  isInitials,
  dimensions,
  zoom = 1,
}: Props) {
  const baseColor = colorOne || "#b7b7b7";
  const accentColor = colorTwo || colorOne || "#b7b7b7";
  const useRainbow = mode === "rainbow";
  // Match live site defaults; both text and heart start as neutral gray.
  const textColorValue = textColor || "#b7b7b7";
  const heartColorValue = heartColor || "#b7b7b7";
  const pinOpacity = showPinstripe || mode === "pinstripe" ? 1 : 0;
  const pinFill = "#ffffff";

  const gradStops = useMemo(() => {
    type Grad = {
      id: string;
      c1: string;
      c2: string;
      x1: number | string;
      y1: number | string;
      x2: number | string;
      y2: number | string;
      units: "objectBoundingBox" | "userSpaceOnUse";
      transform?: string;
    };

    if (useRainbow) {
      // Mirrors the live site rainbow jacket orientation/colour mapping.
      const rainbow: Grad[] = [
        { id: "_Linear1", c1: "#0df228", c2: "#0df2c9", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(58.2986,250.337,-250.337,58.2986,1117.69,1672.44)" },
        { id: "_Linear2", c1: "#e5f20d", c2: "#0df228", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(69.8054,303.341,-303.341,69.8054,1014.94,1274.26)" },
        { id: "_Linear3", c1: "#ff0c06", c2: "#e5f20d", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(39.4972,159.754,-159.754,39.4972,815.465,1076.02)" },
        { id: "_Linear4", c1: "#0df2c9", c2: "#0d79f2", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(14.416,64.8718,-64.8718,14.416,987.75,2022.85)" },
        { id: "_Linear5", c1: "#f20daf", c2: "#f20d0d", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(270.104,-97.6293,97.6293,270.104,774.677,1148.11)" },
        { id: "_Linear6", c1: "#f20d0d", c2: "#e5f20d", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(268.585,129.499,-129.499,268.585,1121.41,1043.41)" },
        { id: "_Linear7", c1: "#e5f20d", c2: "#43f20d", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(113.963,280.367,-280.367,113.963,1440.27,1208.82)" },
        { id: "_Linear8", c1: "#43f20d", c2: "#0df2c9", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(-96.9443,248.7,-248.7,-96.9443,1559.17,1555.87)" },
        { id: "_Linear9", c1: "#0df2c9", c2: "#0d79f2", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(-97.4355,80.4571,-80.4571,-97.4355,1384.96,1904.82)" },
        { id: "_Linear10", c1: "#0d79f2", c2: "#930df2", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(-265.764,-119.39,119.39,-265.764,1038.67,2012.12)" },
        { id: "_Linear11", c1: "#930df2", c2: "#e40df2", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(-112.255,-299.518,299.518,-112.255,710.59,1846.69)" },
        { id: "_Linear12", c1: "#e40df2", c2: "#f20daf", x1: 0, y1: 0, x2: 1, y2: 0, units: "userSpaceOnUse", transform: "matrix(117.362,-262.064,262.064,117.362,588.757,1473.65)" },
      ];
      return rainbow;
    }

    const pairs: Grad[] = [];
    for (let i = 1; i <= 12; i++) {
      const even = i % 2 === 0;
      const isBodyPanel = i <= 4; // first 4 gradients map to the long body faces
      if (mode === "two_colour") {
        const solid = isBodyPanel ? (even ? accentColor : baseColor) : (even ? baseColor : accentColor);
        pairs.push({ id: `_Linear${i}`, c1: solid, c2: solid, x1: 0, y1: 0, x2: 1, y2: 0, units: "objectBoundingBox" });
      } else {
        pairs.push({ id: `_Linear${i}`, c1: baseColor, c2: baseColor, x1: 0, y1: 0, x2: 1, y2: 0, units: "objectBoundingBox" });
      }
    }
    return pairs;
  }, [useRainbow, mode, baseColor, accentColor]);
  const outerSegments = useMemo(
    () => [
      {
        cls: "outerOdd outer",
        d: "M907.309,1672.68L1437.56,1564.15C1437.58,1565.61 1437.56,1567.69 1437.56,1569.15C1437.58,1719.3 1412.6,1845.96 1342.48,1935.19C1342.2,1935.54 742.326,2073.26 743.15,2072.42C772.523,2042.36 803.104,2004.61 826.283,1965.99C861.984,1906.51 907.197,1809.99 907.309,1672.68Z",
        transform: "matrix(0.937324,0,0,0.937324,229.936,-910.218)",
        grad: "_Linear1",
      },
      {
        cls: "outerEven outer",
        d: "M742.393,1274.78C742.222,1274.61 1296.08,1177.34 1296.08,1177.34C1379.2,1281.81 1436.1,1422.51 1437.56,1564.15C1437.57,1564.34 907.317,1672.83 907.312,1672.59C906.976,1657.66 906.524,1642.03 905.419,1626.47C897.456,1514.32 847.709,1411.5 809.376,1355.58C789.09,1325.99 765.526,1298.04 742.393,1274.78Z",
        transform: "matrix(0.937324,0,0,0.937324,229.936,-910.218)",
        grad: "_Linear2",
      },
      {
        cls: "outerOdd outer",
        d: "M1296.08,1177.34C1296.18,1177.47 742.638,1274.96 742.456,1274.78C707.605,1239.89 672.406,1213.43 649.58,1199.64C591.337,1164.46 537.508,1137.15 471.298,1123.27C356.03,1099.1 301.459,1107.89 301.495,1108.94L884.527,1021.79L1002.25,1005.92C1038.96,1009.4 1066.39,1012.8 1101.2,1026.08C1172.26,1053.2 1240.26,1107.43 1296.08,1177.34Z",
        transform: "matrix(0.937324,0,0,0.937324,229.936,-910.218)",
        grad: "_Linear3",
      },
      {
        cls: "outerEven outer",
        d: "M742.911,2072.55C742.911,2072.55 1342.62,1935.04 1342.4,1935.3C1297.2,1991.98 1232.53,2034.58 1144.22,2058.14C1105.1,2068.57 533.802,2206.44 533.802,2206.44C533.802,2206.44 594.834,2188.57 669.252,2135.58C691.547,2119.7 716.221,2099.24 740.297,2075.16C741.175,2074.29 742.911,2072.55 742.911,2072.55Z",
        transform: "matrix(0.937324,0,0,0.937324,229.936,-910.218)",
        grad: "_Linear4",
      },
      {
        cls: "outerEven outer",
        d: "M705.945,1150.32C705.945,1150.32 712.415,1144.13 713.815,1142.79C807.088,1053.58 932.802,998.011 1071.38,995.662C1073.62,995.624 1082.55,995.59 1082.55,995.59L1082.5,1092.31C1082.5,1092.31 1071.38,1092.45 1069.44,1092.47C954.187,1093.94 855.963,1138.24 781.149,1207.23C778.985,1209.23 771.679,1215.96 771.679,1215.96L705.945,1150.32Z",
        transform: "matrix(1,0,0,1,-531.051,-867.499)",
        grad: "_Linear5",
      },
      {
        cls: "outerOdd outer",
        d: "M1082.57,1091.86L1082.5,995.481C1082.5,995.481 1090.44,995.668 1093.26,995.735C1231.33,998.991 1356.41,1055.08 1449.07,1144.54C1450.56,1145.98 1456.9,1152.1 1456.9,1152.1L1386.84,1222.18C1386.84,1222.18 1376.35,1212.05 1375.09,1210.83C1303.67,1141.83 1201.76,1095.94 1095.53,1092.43C1089.65,1092.24 1082.57,1091.86 1082.57,1091.86Z",
        transform: "matrix(1,0,0,1,-531.051,-867.499)",
        grad: "_Linear6",
      },
      {
        cls: "outerEven outer",
        d: "M1386.59,1222.1L1456.95,1152.17C1456.95,1152.17 1462.82,1158.31 1463.98,1159.52C1552.2,1251.71 1607.54,1375.61 1611.1,1512.3C1611.17,1515.26 1611.43,1525.04 1611.43,1525.04L1512.15,1524.86C1512.15,1524.86 1511.8,1514.29 1511.73,1511.97C1508.21,1403.88 1463.35,1303.31 1394.22,1230.26C1392.36,1228.29 1386.59,1222.1 1386.59,1222.1Z",
        transform: "matrix(1,0,0,1,-531.051,-867.499)",
        grad: "_Linear7",
      },
      {
        cls: "outerOdd outer",
        d: "M1457.56,1899.91L1389.18,1830.49C1389.18,1830.49 1396.14,1822.91 1397.57,1821.35C1465.82,1746.98 1508.44,1644.93 1511.66,1541.24C1511.72,1539.31 1512.05,1524.87 1512.05,1524.87L1611.48,1525.1C1611.48,1525.1 1611.19,1536.67 1611.11,1540.01C1607.66,1676.06 1552.91,1799.45 1465.5,1891.55C1464.16,1892.96 1457.56,1899.91 1457.56,1899.91Z",
        transform: "matrix(1,0,0,1,-531.051,-867.499)",
        grad: "_Linear8",
      },
      {
        cls: "outerEven outer",
        d: "M1083.58,2057.2L1083.97,1962.98C1083.97,1962.98 1091.88,1962.68 1093.9,1962.6C1199.42,1958.61 1303.78,1914.76 1381.34,1837.96C1383.44,1835.88 1389.02,1830.46 1389.02,1830.46L1457.63,1899.85C1457.63,1899.85 1450.65,1906.59 1449.05,1908.13C1356.88,1997.12 1232.61,2053.09 1095.4,2056.87C1093.36,2056.93 1083.58,2057.2 1083.58,2057.2Z",
        transform: "matrix(1,0,0,1,-531.051,-867.499)",
        grad: "_Linear9",
      },
      {
        cls: "outerOdd outer",
        d: "M705.272,1901.72L770.491,1837.55C770.491,1837.55 782.629,1848.81 784.183,1850.22C861.347,1920.27 962.822,1961.84 1071.84,1962.88C1073.71,1962.89 1083.97,1962.99 1083.97,1962.99L1083.92,2056.47C1083.92,2056.47 1069.21,2056.96 1067.04,2056.91C930.474,2053.49 806.654,1998.39 714.419,1910.44C712.437,1908.55 705.272,1901.72 705.272,1901.72Z",
        transform: "matrix(1,0,0,1,-531.051,-867.499)",
        grad: "_Linear10",
      },
      {
        cls: "outerEven outer",
        d: "M549.799,1523.22L640.633,1523.86C640.633,1523.86 640.957,1535.3 641.032,1537.98C644.205,1650.02 686.565,1748.98 761.21,1827.89C762.919,1829.7 770.394,1837.5 770.394,1837.5L705.483,1901.78C705.483,1901.78 699.159,1895.3 697.415,1893.49C608.141,1800.36 552.446,1674.8 549.88,1536.34C549.84,1534.22 549.799,1523.22 549.799,1523.22Z",
        transform: "matrix(1,0,0,1,-531.051,-867.499)",
        grad: "_Linear11",
      },
      {
        cls: "outerOdd outer",
        d: "M771.879,1216.13C771.879,1216.13 764.817,1223.45 763.608,1224.7C691.758,1299.11 645.595,1396.49 641.081,1511.68C640.954,1514.94 640.513,1523.85 640.513,1523.85L549.608,1523.04C549.608,1523.04 549.955,1512.68 550.021,1510.44C554.041,1374.01 609.654,1250.43 698.005,1158.56C699.294,1157.22 705.841,1150.41 705.841,1150.41L771.879,1216.13Z",
        transform: "matrix(1,0,0,1,-531.051,-867.499)",
        grad: "_Linear12",
      },
    ],
    []
  );

  const previewSize = dimensions ?? previewDimensions;
  const clampedZoom = Number.isFinite(zoom) ? Math.min(2, Math.max(1, zoom)) : 1;
  const zoomedWidth = CANVAS_WIDTH / clampedZoom;
  const zoomedHeight = CANVAS_HEIGHT / clampedZoom;
  const viewBoxX = (CANVAS_WIDTH - zoomedWidth) / 2;
  const viewBoxY = (CANVAS_HEIGHT - zoomedHeight) / 2;
  const viewBox = `${viewBoxX} ${viewBoxY} ${zoomedWidth} ${zoomedHeight}`;

  return (
    <div className={`${sora.className} flex w-full items-center justify-center bg-white p-[0.1rem]`}>
      <div
        className="relative mx-auto w-full"
        style={{
          maxWidth: previewSize.width,
          aspectRatio: `${previewSize.width} / ${previewSize.height}`,
        }}
      >
        <svg
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "100%", height: "100%", display: "block" }}
          role="img"
        >
          <defs>
            {gradStops.map((stop) => (
              <linearGradient
                key={stop.id}
                id={stop.id}
                x1={stop.x1}
                y1={stop.y1}
                x2={stop.x2}
                y2={stop.y2}
                gradientUnits={stop.units}
                gradientTransform={stop.transform}
              >
                <stop offset="0" stopColor={stop.c1}></stop>
                <stop offset="1" stopColor={stop.c2}></stop>
              </linearGradient>
            ))}
          </defs>
      <style>
        {`
          .outerOdd, .outerEven { transition: 0.2s ease-in-out; }
          .pinStripe { fill: ${pinFill}; opacity: ${pinOpacity}; transition: 0.2s ease-in-out; }
            `}
          </style>
          {/* Shadow */}
          <g transform="matrix(0.928286,0,0,0.802066,-543.761,-524.193)">
            <path
              d="M845.291,1978.12C649.211,2014.22 690.126,2107.34 832.801,2144.34C949.596,2174.63 1034.55,2179.29 1277.71,2170.85C1520.88,2162.42 1705.59,2058.79 1904.13,2024.69C2102.66,1990.59 2258.17,1833.56 2045.46,1823.02C1832.74,1812.47 1675.93,1821.09 1449.04,1846.75C1222.15,1872.42 1089.26,1933.2 845.291,1978.12Z"
              style={{ fill: "rgba(180,180,180,0.36)" }}
            />
          </g>
          {/* Outer and body segments */}
          {outerSegments.map((seg, idx) => (
            <g key={idx} transform={seg.transform}>
              <path
                d={seg.d}
                fill={`url(#${seg.grad})`}
                className={seg.cls}
              />
            </g>
          ))}
          {/* Pinstripes */}
          {[
            "M668.978,1188.82C668.978,1188.82 697.192,1159.47 704.961,1151.39C712.73,1143.31 741.601,1117.89 741.601,1117.89L797.382,1192.83C797.382,1192.83 777.343,1210.36 768.934,1219.16C761.968,1226.46 742,1247.37 742,1247.37L668.978,1188.82Z",
            "M553.049,1473.68L642.295,1489.43C642.295,1489.43 639.736,1519.05 639.813,1527.97C639.89,1536.89 642.463,1565 642.463,1565L553.85,1582.41C553.85,1582.41 549.689,1533.64 549.655,1525.13C549.621,1516.62 553.049,1473.68 553.049,1473.68Z",
            "M741.433,1805.9C741.433,1805.9 761.687,1829.3 770.647,1837.7C778.621,1845.18 794.911,1860.46 794.911,1860.46L739.37,1932.63C739.37,1932.63 712.9,1908.42 704.387,1900.11C695.875,1891.81 667.26,1859.25 667.26,1859.25L741.433,1805.9Z",
            "M1037.1,1961.74C1037.1,1961.74 1071.4,1963.37 1081.1,1963.19C1095.94,1962.92 1118.4,1960.7 1118.4,1960.7L1135.76,2053.28C1135.76,2053.28 1102.32,2056.77 1081.16,2056.81C1067.85,2056.84 1017.86,2056.95 1017.86,2056.95L1037.1,1961.74Z",
            "M1414.73,1803.03C1414.73,1803.03 1397.21,1822.32 1388.62,1830.95C1380.03,1839.57 1358.9,1858.3 1358.9,1858.3L1413.47,1938.34L2000.88,1792.44C2000.88,1792.44 2015.26,1776.77 2024.81,1765.06C2032.62,1755.48 2042.48,1738.84 2042.48,1738.84L1486.36,1863.96L1414.73,1803.03Z",
            "M1509.97,1486.83C1509.97,1486.83 1511.79,1511.95 1511.96,1524.84C1512.14,1537.88 1510.46,1562.84 1510.46,1562.84L1606.79,1574.91L2109.17,1466.34C2109.17,1466.34 2109.1,1433.59 2109.08,1422.33C2109.05,1411.07 2106.94,1381.02 2106.94,1381.02L1607.44,1481.49L1509.97,1486.83Z",
            "M1358.94,1195.78C1358.94,1195.78 1378.82,1213.96 1386.9,1222.05C1394.98,1230.14 1413.14,1248.33 1413.14,1248.33L1485.7,1187.86L2002.06,1095.68C2002.06,1095.68 1987.68,1075.91 1978.03,1062.65C1972.12,1054.52 1945.57,1025.86 1945.57,1025.86L1411.89,1115.81L1358.94,1195.78Z",
            "M1135.12,1000.26L1115.88,1093.03C1104.22,1092.12 1088.07,1091.77 1076.38,1091.75C1064.43,1091.72 1052.94,1092.27 1041.02,1093.13L1025.02,999.291L1679.64,898.627C1679.64,898.627 1694.48,899.121 1705.58,899.698C1711.71,900.017 1763.08,908.147 1763.08,908.147L1135.12,1000.26Z",
          ].map((d, idx) => (
            <g key={idx} transform="matrix(1,0,0,1,-531.051,-867.499)" style={{ opacity: pinOpacity }}>
              <path d={d} className="pinStripe" />
            </g>
          ))}
          {/* Inner circles */}
          <g transform="matrix(0.979136,0,0,0.979136,6.78919,16.7037)">
            <circle cx="549.755" cy="656.823" r="444.797" style={{ fill: "#ffffff", stroke: "rgba(220,220,220,0.5)", strokeWidth: "4.18px" }} />
          </g>
          <g transform="matrix(0.997792,0,0,0.997792,4.06358,1.45654)">
            <circle cx="544.367" cy="659.802" r="532.08" style={{ fill: "none", stroke: "rgba(220,220,220,0.5)", strokeWidth: "4.18px" }} />
          </g>
        </svg>
        {/* Text / logo overlay */}
      <OverlayText
        logoUrl={logoUrl}
        lineOne={lineOne}
          lineTwo={lineTwo}
          designText={designText}
          showHeart={showHeart}
          textColor={textColorValue}
          heartColor={heartColorValue}
          isInitials={isInitials}
          viewBox={viewBox}
        />
      </div>
    </div>
  );
}

type OverlayProps = {
  logoUrl?: string | null;
  lineOne?: string;
  lineTwo?: string;
  designText?: string;
  showHeart?: boolean;
  textColor: string;
  heartColor: string;
  isInitials?: boolean;
  viewBox: string;
};

function OverlayText({
  logoUrl,
  lineOne,
  lineTwo,
  designText,
  showHeart,
  textColor,
  heartColor,
  isInitials,
  viewBox,
}: OverlayProps) {
  // Match the inner circle center in the SVG paths.
  const cx = 544.367;
  const cy = 659.802;
  const arcRadius = 320; // tuned to mimic the live site arc curvature
  const fontFamily = "sans-serif";
  const arcFontSizeBase = 122; // maps to ~24px at rendered size
  const weddingArcFontSize = 130; // slightly larger for wedding arcs
  const singleArcFontSize = 122;
  const straightFontSize = 122;
  const initialsFontSize = 180; // maps to ~35px at rendered size
  const heartScale = 9.49;
  const logoSize = 620;
  const logoOffset = logoSize / 2;
  const cappedDesign = (designText || lineOne || "").slice(0, 14);
  const hasLineOne = Boolean(lineOne);
  const hasLineTwo = Boolean(lineTwo);
  const hasTwoLines = hasLineOne && hasLineTwo;
  const hasAnyWeddingNames = showHeart && !isInitials && (hasLineOne || hasLineTwo);
  const initialsHeuristic = hasTwoLines && (lineOne?.length || 0) <= 3 && (lineTwo?.length || 0) <= 3;
  const initialsMode = Boolean(isInitials ?? initialsHeuristic);
  const straightMode =
    !initialsMode && !logoUrl && !hasTwoLines && cappedDesign.length <= 6 && !hasAnyWeddingNames;
  const arcMode = !initialsMode && !logoUrl && (!straightMode || hasTwoLines || hasAnyWeddingNames);
  const heartFill = heartColor;
  const heartTransform = (yOffset = 0) => `translate(${cx} ${cy + yOffset}) scale(${heartScale}) translate(-12 -12)`;
  const initialsYOffset = 0;
  const straightYOffset = 0;
  const arcLetterSpacing = hasAnyWeddingNames ? "0.08em" : hasTwoLines ? "0.08em" : "0.02em";
  const arcFontSize = hasAnyWeddingNames ? weddingArcFontSize : arcFontSizeBase;
  const lowerArcYOffset = 24;
  const hasAnyText =
    Boolean((lineOne || "").trim().length) || Boolean((lineTwo || "").trim().length) || Boolean((designText || "").trim().length);

  if (showHeart && !hasAnyText && !logoUrl) {
    return (
      <svg className="pointer-events-none absolute inset-0" viewBox={viewBox} xmlns="http://www.w3.org/2000/svg">
        <g transform={heartTransform()}>
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill={heartFill}
          />
        </g>
      </svg>
    );
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily }}
    >
      <defs>
        <path id="upperArc" d={`M ${cx - arcRadius} ${cy} A ${arcRadius} ${arcRadius} 0 0 1 ${cx + arcRadius} ${cy}`} />
        <path id="lowerArc" d={`M ${cx - arcRadius} ${cy + lowerArcYOffset} A ${arcRadius} ${arcRadius} 0 0 0 ${cx + arcRadius} ${cy + lowerArcYOffset}`} />
        <clipPath id="logoClip">
          <rect x={cx - logoOffset} y={cy - logoOffset} width={logoSize} height={logoSize} rx={logoSize * 0.1} ry={logoSize * 0.1} />
        </clipPath>
      </defs>
      {logoUrl ? (
        <image
          href={logoUrl}
          x={cx - logoOffset}
          y={cy - logoOffset}
            width={logoSize}
            height={logoSize}
            clipPath="url(#logoClip)"
            preserveAspectRatio="xMidYMid slice"
        />
      ) : initialsMode ? (
        <>
          <text
            x={cx - 230}
            y={cy + initialsYOffset}
            fontSize={initialsFontSize}
            fontWeight="700"
            fill={textColor}
            textAnchor="middle"
            dominantBaseline="middle"
            letterSpacing="0.2em"
          >
            {(lineOne || "").toUpperCase()}
          </text>
          {showHeart && (
            <g transform={heartTransform()}>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill={heartFill}
              />
            </g>
          )}
          <text
            x={cx + 230}
            y={cy + initialsYOffset}
            fontSize={initialsFontSize}
            fontWeight="700"
            fill={textColor}
            textAnchor="middle"
            dominantBaseline="middle"
            letterSpacing="0.2em"
          >
            {(lineTwo || "").toUpperCase()}
          </text>
        </>
      ) : arcMode && hasTwoLines ? (
        <>
          <text fontSize={arcFontSize} fontWeight="700" fill={textColor} letterSpacing={arcLetterSpacing}>
            <textPath href="#upperArc" startOffset="50%" textAnchor="middle" dominantBaseline="middle">
              {(lineOne || "").toUpperCase()}
            </textPath>
          </text>
          {showHeart && (
            <g transform={heartTransform()}>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill={heartColor}
              />
            </g>
          )}
          <text fontSize={arcFontSize} fontWeight="700" fill={textColor} letterSpacing={arcLetterSpacing}>
            <textPath href="#lowerArc" startOffset="50%" textAnchor="middle" dominantBaseline="middle">
              {(lineTwo || "").toUpperCase()}
            </textPath>
          </text>
        </>
      ) : arcMode && hasAnyWeddingNames ? (
        <>
          {showHeart && (
            <g transform={heartTransform()}>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill={heartColor}
              />
            </g>
          )}
          {hasLineOne ? (
            <text fontSize={arcFontSize} fontWeight="700" fill={textColor} letterSpacing={arcLetterSpacing}>
              <textPath href="#upperArc" startOffset="50%" textAnchor="middle" dominantBaseline="middle">
                {(lineOne || "").toUpperCase()}
              </textPath>
            </text>
          ) : null}
          {!hasLineTwo ? null : (
            <text fontSize={arcFontSize} fontWeight="700" fill={textColor} letterSpacing={arcLetterSpacing}>
              <textPath href="#lowerArc" startOffset="50%" textAnchor="middle" dominantBaseline="middle">
                {(lineTwo || "").toUpperCase()}
              </textPath>
            </text>
          )}
        </>
      ) : arcMode ? (
        <text fontSize={singleArcFontSize} fontWeight="700" fill={textColor} letterSpacing={arcLetterSpacing}>
          <textPath href="#upperArc" startOffset="50%" textAnchor="middle" dominantBaseline="middle">
            {cappedDesign.toUpperCase()}
          </textPath>
        </text>
      ) : (
        <>
          <text
            x={cx}
            y={cy + straightYOffset}
            fontSize={straightFontSize}
            fontWeight="700"
            fill={textColor}
            textAnchor="middle"
            dominantBaseline="middle"
            letterSpacing="0"
          >
            {cappedDesign.toUpperCase()}
          </text>
          {showHeart && hasTwoLines && (
            <g transform={heartTransform(20)}>
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                fill={heartColor}
              />
            </g>
          )}
        </>
      )}
    </svg>
  );
}
