"use client";

import Image from "next/image";
import Link from "next/link";
import { FC } from "react";

const Navbar: FC = () => {
  return (
    <nav className="w-full bg-white border-b shadow-sm fixed top-0 left-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex flex-col items-start">
            <Image
              src="/logo.png"
              alt="Quick Verdicts Logo"
              width={200}
              height={65}
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-8 text-[#0A2342] text-base font-medium">
          <Link href="#">
            About QV
          </Link>
          <Link href="/contact" className="text-[#0A2342] hover:text-[#1a3666]">
            Contact Us
          </Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 bg-[#0A2342] text-white rounded-md font-semibold ml-2 hover:bg-[#132c54] transition"
          >
            Sign Up
          </Link>
          <Link
            href="/login"
            className="px-4 py-1.5 border border-[#0A2342] rounded-md font-semibold ml-2 hover:bg-[#f3f6fa] transition"
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
