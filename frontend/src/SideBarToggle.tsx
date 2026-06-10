"use client";

import { useState } from "react";

// Hamburger icon (visible when sidebar closed)
const MenuIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-zinc-600 hover:text-blue-600 transition-colors"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

// Close icon (visible inside sidebar when open)
const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-zinc-500 hover:text-blue-600 transition-colors"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// Dashboard icon (blue)
const DashboardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-blue-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"
    />
  </svg>
);

// Studio icon (blue)
const StudioIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-blue-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

export default function SidebarToggle() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button – only visible when sidebar is closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-5 left-5 z-30 focus:outline-none"
          aria-label="Open sidebar"
        >
          <MenuIcon />
        </button>
      )}

      {/* Sidebar – slides in from left */}
      <div
        className={`
          fixed top-0 left-0 h-screen w-64 bg-white
          border-r-2 border-green-500 shadow-lg
          transition-transform duration-300 ease-in-out
          z-20 font-sans
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Close button – inside sidebar, top-right corner, only when open */}
        {open && (
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 focus:outline-none"
            aria-label="Close sidebar"
          >
            <CloseIcon />
          </button>
        )}

        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="px-6 pt-8 pb-4 border-b border-green-200">
            <h1 className="text-xl font-semibold text-zinc-800 tracking-tight">
              Gogi-TV-Monitor
            </h1>
            <p className="text-xs text-green-600 mt-0.5">secure platform</p>
          </div>

          {/* Navigation – blue text and icons */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                         text-blue-600 font-medium text-sm uppercase tracking-wide
                         hover:bg-green-50 transition-colors"
              onClick={() => console.log("Dashboard")}
            >
              <DashboardIcon />
              <span>Dashboard</span>
            </button>

            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                         text-blue-600 font-medium text-sm uppercase tracking-wide
                         hover:bg-green-50 transition-colors"
              onClick={() => console.log("Studio")}
            >
              <StudioIcon />
              <span>Studio</span>
            </button>
          </nav>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-green-100 text-xs text-zinc-400">
            v2.0 • secure
          </div>
        </div>
      </div>

      {/* Optional backdrop for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-10 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}