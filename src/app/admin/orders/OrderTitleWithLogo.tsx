import Image from "next/image";
import type { OrderRow } from "@/lib/data";

type OrderTitleWithLogoProps = {
  order: Pick<OrderRow, "category_id" | "design_type" | "logo_url">;
  title: string;
  className?: string;
  logoClassName?: string;
  imageClassName?: string;
};

const isBrandedOrder = (order: Pick<OrderRow, "category_id" | "design_type">) =>
  order.category_id === "branded" || order.design_type === "branded";

export default function OrderTitleWithLogo({
  order,
  title,
  className = "",
  logoClassName = "h-5 w-5",
  imageClassName = "h-7 w-7",
}: OrderTitleWithLogoProps) {
  const logoUrl = isBrandedOrder(order) ? order.logo_url?.trim() : "";

  return (
    <span className={`break-words align-middle ${className}`}>
      <span>{title}</span>
      {logoUrl ? (
        <>
        {"\u00a0"}
        <span
          className={`ml-3 inline-flex shrink-0 items-center justify-center overflow-visible p-0 align-text-bottom ${logoClassName}`}
          title="Uploaded logo"
        >
          <Image
            src={logoUrl}
            alt="Uploaded logo"
            width={24}
            height={24}
            unoptimized
            className={`max-w-none object-contain ${imageClassName}`}
          />
        </span>
        </>
      ) : null}
    </span>
  );
}
