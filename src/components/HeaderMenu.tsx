"use client";

import dynamic from "next/dynamic";

function HeaderMenuFallback() {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 items-center justify-center text-[#ff6f95] opacity-80"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM7.17 14h9.95c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0 0 21.58 5H6.21l-.94-2H2v2h1.73l3.6 7.59-1.35 2.45A2 2 0 0 0 7.7 18H20v-2H7.7l1.1-2Z"
          />
        </svg>
      </span>
    </div>
  );
}

const HeaderMenuClient = dynamic(() => import("./HeaderMenuClient"), {
  ssr: false,
  loading: () => <HeaderMenuFallback />,
});

export default function HeaderMenu() {
  return <HeaderMenuClient />;
}
