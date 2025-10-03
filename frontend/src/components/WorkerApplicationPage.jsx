import React, { useState } from "react";

function WorkerApplicationPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    skills: "",
    experience: "",
    resume: null,
    photoID: null,
    coinsPaid: false,
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked });
    } else if (type === "file") {
      setFormData({ ...formData, [name]: files });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handlePayment = () => {
    // Simulate coin payment success
    setPaymentSuccess(true);
    setFormData((prev) => ({ ...prev, coinsPaid: true }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.coinsPaid;
      return newErrors;
    });
  };

  const validate = () => {
    const errs = {};
    if (!formData.fullName.trim()) errs.fullName = "Full name is required";
    if (!formData.email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = "Invalid email address";
    if (!formData.phone.trim()) errs.phone = "Phone number is required";
    if (!formData.location.trim()) errs.location = "Current location is required";
    if (!formData.skills.trim()) errs.skills = "Please list your skills";
    if (!formData.experience.trim()) errs.experience = "Please describe your experience";
    if (!formData.resume || formData.resume.length === 0) errs.resume = "Please upload your resume";
    if (!formData.photoID || formData.photoID.length === 0) errs.photoID = "Please upload your photo ID";
    if (!formData.coinsPaid) errs.coinsPaid = "You must pay 150 coins before submitting";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#0a174e] via-[#161f39] to-[#1a213a] p-6">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8 text-center">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Application Submitted</h2>
          <p className="text-gray-700 mb-6">
            Thank you for applying! We will review your submission and get back to you soon.
          </p>
          <button
            onClick={() => {
              setFormData({
                fullName: "",
                email: "",
                phone: "",
                location: "",
                skills: "",
                experience: "",
                resume: null,
                photoID: null,
                coinsPaid: false,
              });
              setErrors({});
              setSubmitted(false);
              setPaymentSuccess(false);
            }}
            className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition"
          >
            Submit Another Application
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-[#0a174e] via-[#161f39] to-[#1a213a] flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-8 overflow-auto max-h-screen">
        <h2 className="text-3xl font-extrabold text-blue-900 mb-6 text-center">Worker Application</h2>

        {/* Instructions Box */}
        <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mb-6 text-blue-900 text-sm leading-relaxed">
          <p>Please read before applying:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>If your application is verified and accepted, you will receive a confirmation email with your account password.</li>
            <li>If your application is not accepted, 75 coins will be refunded.</li>
            <li>You must pay <strong>150 coins</strong> as payment before submitting this application.</li>
            <li>Ensure all contact info and documents are accurate to avoid delays.</li>
            <li>Applications are reviewed within 3-5 business days by our verifiers.</li>
          </ul>
        </div>

        {/* Payment Button and Status */}
        <div className="mb-6 text-center">
          {!paymentSuccess ? (
            <button
              onClick={handlePayment}
              className="bg-yellow-500 text-blue-900 font-extrabold rounded-md px-6 py-3 shadow-md hover:bg-yellow-600 transition transform hover:scale-105"
            >
              Pay 150 Coins
            </button>
          ) : (
            <p className="text-green-700 font-semibold">
              Paid successfully, now click Submit!
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Other fields... replicate from your existing form */}

          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-blue-900 font-semibold mb-1">
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none transition ${
                errors.fullName ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400`}
              placeholder="John Smith"
            />
            {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-blue-900 font-semibold mb-1">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none transition ${
                errors.email ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-blue-900 font-semibold mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none transition ${
                errors.phone ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400`}
              placeholder="+1 234 567 8901"
            />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-blue-900 font-semibold mb-1">
              Current Location
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none transition ${
                errors.location ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400`}
              placeholder="City, State or Area"
            />
            {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
          </div>

          {/* Skills */}
          <div>
            <label htmlFor="skills" className="block text-blue-900 font-semibold mb-1">
              Skills
            </label>
            <textarea
              id="skills"
              name="skills"
              rows={3}
              value={formData.skills}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none resize-none transition ${
                errors.skills ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400`}
              placeholder="E.g., plumbing, electrical repairs, cleaning"
            />
            {errors.skills && <p className="text-red-500 text-sm mt-1">{errors.skills}</p>}
          </div>

          {/* Experience */}
          <div>
            <label htmlFor="experience" className="block text-blue-900 font-semibold mb-1">
              Experience
            </label>
            <textarea
              id="experience"
              name="experience"
              rows={4}
              value={formData.experience}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-md outline-none resize-none transition ${
                errors.experience ? "border-red-500" : "border-gray-300"
              } focus:ring-2 focus:ring-blue-400`}
              placeholder="Briefly describe your work experience"
            />
            {errors.experience && <p className="text-red-500 text-sm mt-1">{errors.experience}</p>}
          </div>

          {/* Resume upload */}
          <div>
            <label htmlFor="resume" className="block text-blue-900 font-semibold mb-1">
              Upload Resume (PDF/DOCX)
            </label>
            <input
              id="resume"
              name="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleChange}
              className={`w-full ${
                errors.resume ? "border-red-500" : "border-gray-300"
              } rounded-md outline-none transition`}
            />
            {errors.resume && <p className="text-red-500 text-sm mt-1">{errors.resume}</p>}
          </div>

          {/* Photo ID upload */}
          <div>
            <label htmlFor="photoID" className="block text-blue-900 font-semibold mb-1">
              Upload Photo ID
            </label>
            <input
              id="photoID"
              name="photoID"
              type="file"
              accept="image/*,.pdf"
              onChange={handleChange}
              className={`w-full ${
                errors.photoID ? "border-red-500" : "border-gray-300"
              } rounded-md outline-none transition`}
            />
            {errors.photoID && <p className="text-red-500 text-sm mt-1">{errors.photoID}</p>}
          </div>

          {/* Confirmation checkbox - auto-checked on payment */}
          <div className="flex items-center space-x-2">
            <input
              id="coinsPaid"
              name="coinsPaid"
              type="checkbox"
              checked={formData.coinsPaid}
              readOnly
              className="h-5 w-5 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="coinsPaid" className="block text-blue-900 font-semibold">
              150 coins payment received
            </label>
          </div>

          <button
            type="submit"
            disabled={!formData.coinsPaid}
            className={`w-full text-white font-bold py-3 rounded-lg transition ${
              formData.coinsPaid ? "bg-blue-700 hover:bg-blue-800" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
}

export default WorkerApplicationPage;
