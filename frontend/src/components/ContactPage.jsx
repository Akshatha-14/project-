import React, { useState } from "react";

function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = "Name is required";
    if (!formData.email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = "Invalid email address";
    if (!formData.message.trim()) errs.message = "Message cannot be empty";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    // Submit form (API integration)
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#0a174e] via-[#161f39] to-[#1a213a] p-6">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8 text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Thank you!</h2>
          <p className="text-gray-700 mb-6">Your message has been sent. We will get back to you shortly.</p>
          <button
            onClick={() => {
              setFormData({ name: "", email: "", message: "" });
              setErrors({});
              setSubmitted(false);
            }}
            className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition"
          >
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-[#0a174e] via-[#161f39] to-[#1a213a] flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8">
        <h2 className="text-3xl font-extrabold text-blue-900 mb-6 text-center">Contact Us</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-blue-900 font-semibold mb-1">
              Your Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none ${
                errors.name ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400 transition`}
              placeholder="John Doe"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-blue-900 font-semibold mb-1">
              Your Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none ${
                errors.email ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400 transition`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-blue-900 font-semibold mb-1">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              value={formData.message}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none resize-none ${
                errors.message ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400 transition`}
              placeholder="Write your message here..."
            />
            {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 rounded-lg transition"
          >
            Send Message
          </button>
        </form>

        <div className="mt-8 text-center text-gray-700">
          <p>
            Or reach us at:{" "}
            <a href="mailto:support@localserviceprovider.com" className="text-blue-700 hover:underline">
              support@localserviceprovider.com
            </a>
          </p>
          <p>Phone: +1 234 567 8901</p>
          <p>Address: 123 Service St, City, Country</p>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;
