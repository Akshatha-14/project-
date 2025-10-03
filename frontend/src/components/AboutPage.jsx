import React from "react";

function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-[#0a174e] via-[#161f39] to-[#1a213a] flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-8 md:p-12">
        <div className="flex flex-col items-center mb-6">
          <svg
            className="w-14 h-14 text-blue-500 mb-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 15s4 2 8 0"/>
            <ellipse cx="12" cy="9" rx="3" ry="4"/>
          </svg>
          <h1 className="text-3xl md:text-4xl font-extrabold text-blue-900 mb-1 drop-shadow-lg">
            About Local Service Provider
          </h1>
        </div>

        <p className="text-gray-700 text-lg mb-6 text-center">
          <span className="font-bold text-blue-700">Local Service Provider</span> is your go-to platform for discovering trusted home and business services in your area,
          powered by AI for fast, accurate matching. We connect you with experienced and verified professionals, ensuring quality, safety, and seamless booking—whether you need a cleaner, plumber, electrician, or other local experts.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
          <div className="flex flex-col items-center">
            <svg className="w-8 h-8 text-blue-500 mb-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v0m-4-4h8m0 0V8a4 4 0 10-8 0v4z"/>
            </svg>
            <h3 className="text-xl font-bold text-blue-800 mb-1">Our Mission</h3>
            <p className="text-gray-600 text-center">
              To make finding and booking trusted local services effortless, secure, and transparent for everyone.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <svg className="w-8 h-8 text-blue-500 mb-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-3h6v3M9 13V9l1.796-1.796A4 4 0 1116 9v4"/>
            </svg>
            <h3 className="text-xl font-bold text-blue-800 mb-1">Why Choose Us?</h3>
            <ul className="text-gray-600 text-left list-disc list-inside">
              <li>Vetted and skilled professionals</li>
              <li>Fast AI-powered service matching</li>
              <li>Clear pricing and no hidden fees</li>
              <li>Customer support always ready to assist</li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-8">
          <span className="inline-block bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg shadow hover:bg-blue-800 transition">
            Ready to experience convenient service? <br />
            <a href="/" className="underline">Get started today!</a>
          </span>
        </div>
      </div>
    </div>
  );
}

export default AboutPage;
