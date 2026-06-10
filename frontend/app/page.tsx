"use client";

import Link from "next/link";
import SidebarToggle from "@/src/SideBarToggle";
import InstanceList from "@/src/InstanceList"

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <SidebarToggle />

      <h1 className="fixed top-5 left-1/2 -translate-x-1/2 z-30 text-2xl font-semibold text-zinc-800 whitespace-nowrap">
        Welcome to FinTech Dashboard
      </h1>

      <Link href="/studio">
        <button
          className="fixed top-5 right-5 z-30 px-4 py-2 bg-green-600 hover:bg-green-700 
                     text-white font-medium rounded-md shadow-md transition-colors
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          Create Instance
        </button>
      </Link>

      

      <div className="pt-24 px-8 pb-12 max-w-7xl mx-auto">
        <InstanceList />
      </div>
    </main>
  );
}