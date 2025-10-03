import React, { useState, useEffect } from "react";
import axios from "axios";
import forge from "node-forge";

const RSA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr2E29Tw7ZaCeefy0wq64
mtrnP3XgZUB4SexrQzZlW9yQ5T5f8AAhoxH8AK+Sa7N89sx6tjzqFZKHR/r8R8yH
BAO7h4k72wii6gtDIVRXY/c8m5/WOafKNESf5+EtGmZNTlL2riOaNuZCKmlspBxE
OM2V1sAfum4VjrCv4D44UJs6VeWyMV74ucwtLw2Y+7abJJMGzxgchn1gPWAKQL8H
gWQSMmMYSSbs4LgnezpfbZgzc3aCQml86cn/8SbZxX3JuNlSu7G2R/r49TG5yb+1
dM0t8BldFdFG5nt6mduH29+vOTxv0ccPrXaMoRM/E8PhJIxTDW0DZsSwHYUNfM8A
MQIDAQAB
-----END PUBLIC KEY-----
`;

function encryptAESKeyWithRSA(aesKeyBytes) {
  const publicKey = forge.pki.publicKeyFromPem(RSA_PUBLIC_KEY_PEM);
  const encryptedKey = publicKey.encrypt(aesKeyBytes, "RSA-OAEP");
  return forge.util.encode64(encryptedKey);
}

function aesEncrypt(data, aesKeyBytes) {
  const iv = forge.random.getBytesSync(16);
  const cipher = forge.cipher.createCipher("AES-CBC", aesKeyBytes);
  cipher.start({ iv: iv });
  cipher.update(forge.util.createBuffer(data, "utf8"));
  cipher.finish();
  const encrypted = iv + cipher.output.getBytes();
  return forge.util.encode64(encrypted);
}

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith(name + "=")) {
        cookieValue = decodeURIComponent(trimmed.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const InputField = ({ id, label, type = "text", value, onChange, required = false, error, autoComplete, ...props }) => (
  <div className="mb-4 relative group">
    <label
      htmlFor={id}
      className="block text-gray-700 dark:text-gray-200 font-semibold mb-1 transition-all group-focus-within:text-teal-500"
    >
      {label}
    </label>
    <input
      id={id}
      name={id}
      type={type}
      value={value}
      onChange={onChange}
      required={required}
      autoComplete={autoComplete}
      className={`w-full px-4 py-3 border rounded-lg shadow-sm
        focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400
        transition-all duration-300 ease-in-out
        ${error ? "border-red-400" : "border-gray-300"}
        dark:bg-gray-700 dark:text-white dark:border-gray-600
      `}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1 animate-fadeIn">{error}</p>}
  </div>
);

const Button = ({ children, disabled, className = "", ...props }) => (
  <button
    disabled={disabled}
    className={`w-full py-3 rounded-lg text-white bg-gradient-to-r from-teal-400 to-purple-500
      shadow-md hover:scale-105 transform hover:from-teal-500 hover:to-purple-600 transition-all duration-300
      disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {children}
  </button>
);

function SignUp() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get("http://localhost:8000/api/csrf/", { withCredentials: true }).catch(() => {});
  }, []);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = "Name is required";
    if (!formData.email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = "Invalid email address";
    if (!formData.password) errs.password = "Password is required";
    else if (formData.password.length < 6) errs.password = "Password too short";
    if (formData.confirmPassword !== formData.password) errs.confirmPassword = "Passwords must match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSuccessMessage("");
    setErrors({});

    try {
      const aesKeyBytes = forge.random.getBytesSync(32);
      const encryptedData = {
        name: aesEncrypt(formData.name, aesKeyBytes),
        email: aesEncrypt(formData.email, aesKeyBytes),
        password: aesEncrypt(formData.password, aesKeyBytes),
      };
      const encryptedKey = encryptAESKeyWithRSA(aesKeyBytes);
      const payload = { key: encryptedKey, data: encryptedData };
      const csrftoken = getCookie("csrftoken");

      const response = await axios.post("http://localhost:8000/api/signup/", payload, {
        headers: { "X-CSRFToken": csrftoken },
        withCredentials: true,
      });

      setSuccessMessage(response.data.message || "Registration successful");
      setFormData({ name: "", email: "", password: "", confirmPassword: "" });
    } catch (error) {
      if (error.response?.data?.error) setErrors({ api: error.response.data.error });
      else setErrors({ api: "An error occurred. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="w-full max-w-md rounded-2xl shadow-2xl p-8 bg-white/95 dark:bg-gray-800/90 backdrop-blur-md
        transform transition-transform duration-500 hover:scale-105
      ">
        <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100 text-center animate-fadeIn">
          Create Your Account
        </h2>

        {successMessage && (
          <div className="text-green-600 mb-4 text-center font-medium animate-fadeIn">
            {successMessage}
          </div>
        )}
        {errors.api && (
          <div className="text-red-600 mb-4 text-center font-medium animate-fadeIn">
            {errors.api}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <InputField
            id="name"
            label="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
            error={errors.name}
            autoComplete="name"
          />
          <InputField
            id="email"
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            error={errors.email}
            autoComplete="email"
          />
          <InputField
            id="password"
            label="Password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            error={errors.password}
            autoComplete="new-password"
          />
          <InputField
            id="confirmPassword"
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            error={errors.confirmPassword}
            autoComplete="new-password"
          />

          <Button disabled={loading} type="submit">
            {loading ? "Signing Up..." : "Sign Up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <a href="/login" className="text-teal-500 underline hover:text-teal-700 dark:text-teal-400">
            Log in here
          </a>
        </p>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.4s ease-in-out forwards;
          }
        `}
      </style>
    </div>
  );
}

export default SignUp;
