import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import forge from "node-forge";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

const RSA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr2E29Tw7ZaCeefy0wq64
mtrnP3XgZUB4SexrQzZlW9yQ5T5f8AAhoxH8AK+Sa7N89sx6tjzqFZKHR/r8R8yH
BAO7h4k72wii6gtDIVRXY/c8m5/WOafKNESf5+EtGmZNTlL2riOaNuZCKmlspBxE
OM2V1sAfum4VjrCv4D44UJs6VeWyMV74ucwtLw2Y+7abJJMGzxgchn1gPWAKQL8H
gWQSMmMYSSbs4LgnezpfbZgzc3aCQml86cn/8SbZxX3JuNlSu7G2R/r49TG5yb+1
dM0t8BldFdFG5nt6mduH29+vOTxv0ccPrXaMoRM/E8PhJIxTDW0DZsSwHYUNfM8A
MQIDAQAB
-----END PUBLIC KEY-----`;

const encryptAESKeyWithRSA = (aesKeyBytes) => {
  const publicKey = forge.pki.publicKeyFromPem(RSA_PUBLIC_KEY_PEM);
  const encryptedKey = publicKey.encrypt(aesKeyBytes, "RSA-OAEP");
  return forge.util.encode64(encryptedKey);
};

const aesEncrypt = (data, aesKeyBytes) => {
  const iv = forge.random.getBytesSync(16);
  const cipher = forge.cipher.createCipher("AES-CBC", aesKeyBytes);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(data, "utf8"));
  cipher.finish();
  const encrypted = iv + cipher.output.getBytes();
  return forge.util.encode64(encrypted);
};

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

// InputField component
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

// Button component
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

function LoginPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    axios.get("http://localhost:8000/api/csrf/", { withCredentials: true }).catch(() => {});
  }, []);

  const validate = () => {
    const errs = {};
    if (!formData.email.trim()) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errs.email = "Invalid email";
    if (!formData.password) errs.password = "Password is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const aesKeyBytes = forge.random.getBytesSync(32);
      const encryptedEmail = aesEncrypt(formData.email, aesKeyBytes);
      const encryptedPassword = aesEncrypt(formData.password, aesKeyBytes);
      const encryptedKey = encryptAESKeyWithRSA(aesKeyBytes);
      const payload = { key: encryptedKey, data: { email: encryptedEmail, password: encryptedPassword } };
      const csrftoken = getCookie("csrftoken");
      const response = await axios.post("http://localhost:8000/api/login/", payload, {
        headers: { "X-CSRFToken": csrftoken },
        withCredentials: true,
      });

      const { role, profile_complete } = response.data;
      if (!profile_complete) navigate("/complete-address");
      else if (role === "admin") window.location.href = "http://localhost:8000/custom-admin/dashboard";
      else if (role === "worker") navigate("/workerhome");
      else if (role === "user") navigate("/userhome");
      else setApiError("Unknown user role");
    } catch (err) {
      setApiError(err.response?.data?.error || "Network error, please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError(""); setForgotMessage("");
    if (!forgotEmail.trim()) return setForgotError("Email is required");
    setForgotLoading(true);
    try {
      const csrftoken = getCookie("csrftoken");
      await axios.post("http://localhost:8000/api/password-reset/", { email: forgotEmail }, {
        headers: { "X-CSRFToken": csrftoken },
        withCredentials: true,
      });
      setForgotMessage("Password reset email sent, please check your inbox.");
      setForgotEmail("");
    } catch (err) {
      const errData = err.response?.data?.error;
      setForgotError(Array.isArray(errData) ? errData.join(" ") : errData || "Failed to send password reset email.");
    } finally {
      setForgotLoading(false);
    }
  };

  const validateReset = () => {
    if (!newPassword) { setResetError("Password is required"); return false; }
    if (newPassword.length < 6) { setResetError("Password must be at least 6 characters"); return false; }
    setResetError(""); return true;
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!validateReset()) return;
    setResetLoading(true); setResetError(""); setResetSuccess("");
    try {
      const aesKeyBytes = forge.random.getBytesSync(32);
      const encryptedPassword = aesEncrypt(newPassword, aesKeyBytes);
      const encryptedKey = encryptAESKeyWithRSA(aesKeyBytes);
      const csrftoken = getCookie("csrftoken");
      await axios.post(`http://localhost:8000/api/password-reset-confirm/${uid}/${token}/`,
        { key: encryptedKey, data: { password: encryptedPassword } },
        { headers: { "X-CSRFToken": csrftoken }, withCredentials: true }
      );
      setResetSuccess("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      const errData = err.response?.data?.error;
      setResetError(Array.isArray(errData) ? errData.join(" ") : errData || "Failed to reset password.");
    } finally { setResetLoading(false); }
  };

  if (uid && token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        <div className="w-full max-w-sm bg-white/95 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 animate-fadeIn transform transition-transform duration-500 hover:scale-105">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-gray-100">Reset Password</h2>
          {resetError && <div className="text-red-600 mb-3">{resetError}</div>}
          {resetSuccess && <div className="text-green-600 mb-3">{resetSuccess}</div>}
          <form onSubmit={handleResetSubmit}>
            <InputField
              id="newpassword"
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required minLength={6}
              error={resetError}
              autoComplete="new-password"
            />
            <Button disabled={resetLoading}>{resetLoading ? "Resetting..." : "Reset Password"}</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId="884052926166-a23vplmfkgurigk4dufsut9j4588vh8u.apps.googleusercontent.com">
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
        {/* Login Card */}
        <div className="w-full max-w-md bg-white/95 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 space-y-6 animate-fadeIn transform transition-transform duration-500 hover:scale-105">
          <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">Log In</h2>
          {apiError && <div className="text-red-600 text-center mb-4">{apiError}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputField
              id="email"
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required error={errors.email}
              autoComplete="email"
            />
            <InputField
              id="password"
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required error={errors.password}
              autoComplete="current-password"
            />
            <Button disabled={loading}>{loading ? "Logging in..." : "Log In"}</Button>
          </form>
          <div className="flex justify-between items-center mt-2">
            <button type="button" className="text-sm text-teal-500 hover:underline" onClick={() => setShowForgot(true)}>Forgot Password?</button>
          </div>
          <div className="mt-4 text-center">
            <GoogleLogin onSuccess={() => {}} onError={() => {}} />
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgot && (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-gradient-to-br from-teal-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 animate-fadeIn">
            <div className="w-full max-w-sm bg-white/95 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 transform scale-95 opacity-0 animate-popUp">
              <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Reset Password</h3>
              {forgotError && <p className="text-red-600 mb-2">{forgotError}</p>}
              {forgotMessage && <p className="text-green-600 mb-2">{forgotMessage}</p>}
              <form onSubmit={handleForgotSubmit}>
                <InputField
                  id="forgot-email"
                  label="Email Address"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  error={forgotError}
                  autoComplete="email"
                />
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    type="button"
                    onClick={() => { setShowForgot(false); setForgotError(""); setForgotMessage(""); setForgotEmail(""); }}
                    className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 dark:text-white"
                  >
                    Cancel
                  </button>
                  <Button disabled={forgotLoading}>{forgotLoading ? "Sending..." : "Send Reset Link"}</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Animations */}
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-5px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-fadeIn { animation: fadeIn 0.4s ease-in-out forwards; }

            @keyframes popUp {
              0% { opacity: 0; transform: scale(0.9); }
              100% { opacity: 1; transform: scale(1); }
            }
            .animate-popUp { animation: popUp 0.3s ease-out forwards; }
          `}
        </style>
      </div>
    </GoogleOAuthProvider>
  );
}

export default LoginPage;
