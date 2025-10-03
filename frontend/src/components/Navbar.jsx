import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function Navbar() {
  const [mobileNav, setMobileNav] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="w-full bg-gradient-to-r from-[#0a174e] via-[#161f39] to-[#1a213a] text-white shadow-lg fixed top-0 z-50">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Brand */}
        <div className="flex-grow text-center sm:text-left">
          <span className="font-bold text-xl text-white select-none">AI Local Service Provider</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden sm:flex items-center space-x-6">
          {["Home", "Services", "About", "Contact"].map((item) => (
            <Link
              key={item}
              to={item.toLowerCase() === "home" ? "/" : `/${item.toLowerCase()}`}
              className="hover:text-blue-300 px-2 py-1 font-medium transition transform hover:scale-110"
            >
              {item}
            </Link>
          ))}
          <button
            onClick={() => navigate("/login")}
            className="bg-white text-blue-900 font-semibold rounded px-4 py-1 hover:bg-blue-50 border border-blue-100 transition shadow"
          >
            Login
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="bg-white text-blue-900 font-semibold rounded px-4 py-1 hover:bg-blue-50 border border-blue-100 transition shadow"
          >
            Sign Up
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileNav((v) => !v)}
          className="sm:hidden flex flex-col justify-center items-center px-2 py-1 border border-white rounded focus:outline-none"
          aria-label="Toggle mobile menu"
        >
          <span
            className={`block bg-white w-6 h-0.5 mb-1 rounded transition-transform origin-left ${
              mobileNav ? "rotate-45 translate-y-1.5" : ""
            }`}
          ></span>
          <span className={`block bg-white w-6 h-0.5 rounded transition-opacity ${mobileNav ? "opacity-0" : "opacity-100"}`}></span>
          <span
            className={`block bg-white w-6 h-0.5 mt-1 rounded transition-transform origin-left ${
              mobileNav ? "-rotate-45 -translate-y-1.5" : ""
            }`}
          ></span>
        </button>
      </div>

      {/* Mobile Nav Menu */}
      {mobileNav && (
        <div className="sm:hidden bg-gradient-to-r from-[#0a174e] via-[#161f39] to-[#1a213a] px-6 pb-6 space-y-4">
          {["Home", "Services", "About", "Contact"].map((item) => (
            <Link
              key={item}
              to={item.toLowerCase() === "home" ? "/" : `/${item.toLowerCase()}`}
              className="block py-2 border-b border-white text-white font-semibold hover:text-blue-300 transition"
              onClick={() => setMobileNav(false)}
            >
              {item}
            </Link>
          ))}
          <button
            onClick={() => {
              navigate("/login");
              setMobileNav(false);
            }}
            className="w-full bg-white text-blue-900 font-semibold rounded px-4 py-2 hover:bg-blue-50 border border-blue-100 transition shadow"
          >
            Login
          </button>
          <button
            onClick={() => {
              navigate("/signup");
              setMobileNav(false);
            }}
            className="w-full bg-white text-blue-900 font-semibold rounded px-4 py-2 hover:bg-blue-50 border border-blue-100 transition shadow"
          >
            Sign Up
          </button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
