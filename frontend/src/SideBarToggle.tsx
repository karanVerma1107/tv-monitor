"use client";

import { useState } from "react";

export default function SidebarToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-screen w-64 bg-zinc-900 text-white
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-4">
          <h2 className="text-lg font-semibold">Sidebar</h2>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="
          fixed top-4 left-4
          flex h-12 w-12 items-center justify-center
          rounded-full border border-zinc-300 bg-white shadow-md
          hover:bg-zinc-100
        "
      >
        <span
          className={`
            text-xl transition-transform duration-300
            ${open ? "rotate-180" : ""}
          `}
        >
          →
        </span>
      </button>
    </>
  );
}