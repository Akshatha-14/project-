import React from "react";

const services = [
  {
    title: "Cleaner",
    description:
      "Our professional cleaners offer thorough and reliable cleaning services for residential and commercial spaces, ensuring a fresh and hygienic environment tailored to your needs.",
    benefits: [
      "Deep cleaning of every corner",
      "Eco-friendly cleaning supplies",
      "Flexible scheduling",
      "Trusted and background-checked staff",
    ],
    icon: (
      <svg
        className="w-10 h-10 text-blue-500 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5h16M4 5c1.5 7 14.5 7 16 0M9 7v10a4 4 0 004 4h0a4 4 0 004-4V7"
        />
      </svg>
    ),
  },
  {
    title: "Plumber",
    description:
      "Our experienced plumbers handle everything from minor leaks to full installations, ensuring your plumbing systems work flawlessly with timely service and fair pricing.",
    benefits: [
      "Leak repair and pipe replacement",
      "Water heater installation",
      "Emergency services available 24/7",
      "Licensed and insured professionals",
    ],
    icon: (
      <svg
        className="w-10 h-10 text-blue-500 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16l4-4 4 4M4 20h16" />
      </svg>
    ),
  },
  {
    title: "Electrician",
    description:
      "Our certified electricians perform installations, maintenance, and repairs to keep your electrical systems safe, compliant, and efficient.",
    benefits: [
      "Electrical safety inspections",
      "Lighting installation and repair",
      "Upgrade electrical panels",
      "Energy-efficient solutions",
    ],
    icon: (
      <svg
        className="w-10 h-10 text-blue-500 mx-auto mb-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <polygon points="13 2 2 14 12 14 11 22 22 10 12 10 13 2" />
      </svg>
    ),
  },
];

function ServicesSection() {
  return (
    <section className="w-full max-w-5xl mx-auto px-6 py-16">
      <h2 className="text-center text-4xl font-extrabold mb-12 text-blue-900">
        Our Trusted Services
      </h2>
      <p className="max-w-3xl mx-auto text-center text-gray-700 mb-12">
        We pride ourselves on delivering top-notch local services powered by trusted professionals.
        Whether you need a cleaner, plumber, or electrician, find the perfect provider here with verified quality and satisfaction.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {services.map(({ title, description, benefits, icon }) => (
          <article
            key={title}
            className="bg-white rounded-xl shadow-xl p-8 flex flex-col h-full hover:shadow-2xl transition transform hover:scale-105 cursor-pointer"
          >
            <div>{icon}</div>
            <h3 className="text-2xl font-bold mb-3 text-blue-900">{title}</h3>
            <p className="text-gray-700 mb-6 flex-grow">{description}</p>
            <ul className="mb-6 list-disc list-inside text-gray-600 space-y-1">
              {benefits.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
            
          </article>
        ))}
      </div>
    </section>
  );
}

export default ServicesSection;
