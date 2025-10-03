import React, { useState, useEffect } from "react";
import axios from "axios";
import forge from "node-forge";
import PaymentOptions from "./PaymentOptions"; 
import { Toaster, toast } from "react-hot-toast";
// Your RSA public key PEM for encrypting AES key in booking
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

// Encryption helpers
function encryptAESKeyWithRSA(aesKeyBytes) {
  const publicKey = forge.pki.publicKeyFromPem(RSA_PUBLIC_KEY_PEM);
  const encrypted = publicKey.encrypt(aesKeyBytes, "RSA-OAEP");
  return forge.util.encode64(encrypted);
}

function aesEncrypt(data, aesKeyBytes) {
  const iv = forge.random.getBytesSync(16);
  const cipher = forge.cipher.createCipher("AES-CBC", aesKeyBytes);
  cipher.start({ iv: iv });
  cipher.update(forge.util.createBuffer(data, "utf8"));
  cipher.finish();

  const encryptedBytes = iv + cipher.output.getBytes();
  return forge.util.encode64(encryptedBytes);
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

// Booking Details modal
function BookingDetails({ bookingId, onClose }) {
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    async function fetchBooking() {
      const response = await fetch(`http://localhost:8000/api/user/bookings/${bookingId}/`);
      const data = await response.json();
      setBooking(data);
    }
    fetchBooking();
  }, [bookingId]);

  if (!booking) return <div>Loading booking...</div>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md overflow-auto">
        <h2 className="text-xl font-bold mb-4">Booking Details</h2>
        <p><strong>Booking ID:</strong> {booking.id}</p>
        <p><strong>Worker ID:</strong> {booking.worker_id}</p>
        <p><strong>Worker Phone:</strong> {booking.worker_phone}</p>
        <p><strong>Service:</strong> {booking.service?.service_type}</p>
        <p><strong>Tariff:</strong> ₹{booking.tariff_coins}</p>
        <p><strong>Status:</strong> {booking.status}</p>
        <p><strong>Payment Status:</strong> {booking.payment_status}</p>
        <button
          className="mt-4 bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Booking Modal for user
function UserBooking({ worker, userId, onClose }) {
  const [contactDates, setContactDates] = useState([]);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [urgency, setUrgency] = useState("Flexible");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const toggleSlot = (slot) => {
    if (contactDates.includes(slot)) {
      setContactDates(contactDates.filter((s) => s !== slot));
    } else if (contactDates.length < 2) {
      setContactDates([...contactDates, slot]);
    } else {
      alert("You can select up to 2 options.");
    }
  };

  const handlePhotoChange = (e) => {
    setPhotos(Array.from(e.target.files).slice(0, 5));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (contactDates.length === 0) {
      setErrorMsg("Please select at least one contact option.");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("Please provide a job description.");
      return;
    }

    setLoading(true);
    try {
      const aesKeyBytes = forge.random.getBytesSync(32);
      const encryptedKey = encryptAESKeyWithRSA(aesKeyBytes);

      const encryptedData = {
        userId: aesEncrypt(userId.toString(), aesKeyBytes),
        workerId: aesEncrypt(worker.id.toString(), aesKeyBytes),
        contactDates: aesEncrypt(JSON.stringify(contactDates), aesKeyBytes),
        description: aesEncrypt(description, aesKeyBytes),
        urgency: aesEncrypt(urgency, aesKeyBytes),
      };

      const formData = new FormData();
      formData.append("key", encryptedKey);
      formData.append("data", JSON.stringify(encryptedData));
      photos.forEach((photo) => formData.append("photos", photo));

      const csrfToken = getCookie("csrftoken");

      await axios.post("http://localhost:8000/api/bookings/", formData, {
        headers: { "X-CSRFToken": csrfToken },
        withCredentials: true,
      });

      setSuccessMsg("Request sent! The worker will contact you soon.");
      setContactDates([]);
      setDescription("");
      setPhotos([]);
      setUrgency("Flexible");

      setTimeout(onClose, 2500);
    } catch (error) {
      setErrorMsg(error?.response?.data?.error || "Failed to submit booking");
    } finally {
      setLoading(false);
    }
  };

  const dateOptions = ["Morning (8 AM – 12 PM)", "Afternoon (12 PM – 4 PM)", "Choose him for a longer duration"];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg overflow-auto">
        <h2 className="text-xl font-bold mb-4">Book {worker.name}</h2>
        <form onSubmit={handleSubmit}>
          <fieldset className="mb-4">
            <legend className="font-semibold mb-2">Select up to 2 contact date options:</legend>
            {dateOptions.map((option) => (
              <label key={option} className="block mb-1">
                <input
                  type="checkbox"
                  value={option}
                  checked={contactDates.includes(option)}
                  onChange={() => toggleSlot(option)}
                  className="mr-2"
                />
                {option}
              </label>
            ))}
          </fieldset>

          <label className="block mb-4">
            <span className="font-semibold">Job Description:</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full mt-1 border border-gray-300 rounded px-2 py-1"
            />
          </label>

          <label className="block mb-4">
            <span className="font-semibold">Urgency:</span>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded px-2 py-1"
            >
              <option>Flexible</option>
              <option>Urgent</option>
              <option>Normal</option>
            </select>
          </label>

          <label className="block mb-4">
            <span className="font-semibold">Photos (optional, up to 5):</span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoChange}
              className="mt-1"
            />
          </label>

          {errorMsg && <div className="text-red-600 mb-2">{errorMsg}</div>}
          {successMsg && <div className="text-green-600 mb-2">{successMsg}</div>}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Send Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// HomeTab component to show recommended workers and search
function HomeTab({ onBook, recommendedWorkers, loading }) {
  const [search, setSearch] = useState("");

  // Deduplicate workers by ID
  const uniqueWorkers = [];
  const seenIds = new Set();
  for (const worker of recommendedWorkers) {
    if (!seenIds.has(worker.id)) {
      uniqueWorkers.push(worker);
      seenIds.add(worker.id);
    }
  }

  const filteredWorkers = uniqueWorkers.filter(
    (worker) =>
      worker.name.toLowerCase().includes(search.toLowerCase()) ||
      (worker.service.service_type || worker.service).toLowerCase().includes(search.toLowerCase()) ||
      worker.description.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div>Loading recommended professionals...</div>;

  if (filteredWorkers.length === 0) {
    return (
      <section className="max-w-6xl mx-auto pt-4 pb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-900">Recommended Professionals</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or service..."
            className="border border-gray-300 rounded-md px-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className="text-gray-500">No professionals match your search.</p>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto pt-4 pb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Recommended Professionals</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or service..."
          className="border border-gray-300 rounded-md px-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {filteredWorkers.map((worker) => (
          <div
            key={worker.id}
            className={`relative bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col items-center p-6 transition hover:shadow-2xl ${
              !worker.available ? "opacity-50" : ""
            }`}
          >
            <img
              src={worker.avatar}
              alt={worker.name}
              className="mb-3 w-20 h-20 rounded-full border-2 border-blue-300 object-cover shadow"
            />
            <div className="absolute right-3 top-3 text-green-500 font-bold text-xs">
              {worker.available ? "Available" : <span className="text-gray-400">Unavailable</span>}
            </div>
            <div className="w-full text-center mb-2">
              <span className="text-lg font-semibold text-gray-800">{worker.name}</span>
              <div className="text-gray-400">{worker.service.service_type || worker.service}</div>
              <span className="mt-1 inline-block px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">
                {worker.difficulty} Work
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="font-medium text-yellow-500">{worker.rating} ★</span>
              <span className="text-gray-400">|</span>
              <span className="font-semibold text-blue-700">{worker.costPerHour} coins/hr</span>
            </div>
            <p className="text-gray-600 text-center text-sm my-2">{worker.description}</p>
            <button
              className={`mt-4 px-4 py-2 w-full rounded-lg font-semibold ${
                worker.available ? "bg-[#001f3f] text-white hover:bg-[#003366]" : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              onClick={() => worker.available && onBook(worker)}
              disabled={!worker.available}
              type="button"
            >
              Book Now
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function BookingHistory() {
  const MEDIA_BASE_URL = "http://localhost:8000/media/";

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelVisible, setCancelVisible] = useState({});

  useEffect(() => {
    fetchBookingHistory();
  }, []);

  async function fetchBookingHistory() {
    try {
      const response = await axios.get("http://localhost:8000/api/user/bookings/", {
        withCredentials: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      setBookings(response.data);

      // Initialize cancel button visibility and timers
      const now = new Date();
      const visibility = {};
      response.data.forEach((b) => {
        const bookingTime = new Date(b.booking_time);
        const diffMinutes = (now - bookingTime) / 1000 / 60;
        visibility[b.id] = diffMinutes <= 5 && b.status === "booked";

        // Set timer to hide cancel button after 5 minutes
        const timeLeft = 5 * 60 * 1000 - (now - bookingTime);
        if (timeLeft > 0) {
          setTimeout(() => {
            setCancelVisible((prev) => ({ ...prev, [b.id]: false }));
          }, timeLeft);
        }
      });
      setCancelVisible(visibility);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch booking history.");
    } finally {
      setLoading(false);
    }
  }

  const cancelBooking = async (bookingId) => {
    const csrfToken = getCookie("csrftoken");
    try {
      await axios.post(
        `http://localhost:8000/api/bookings/${bookingId}/cancel/`,
        {},
        { headers: { "X-CSRFToken": csrfToken }, withCredentials: true }
      );
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
      );
      setCancelVisible((prev) => ({ ...prev, [bookingId]: false }));
      toast.success("Booking cancelled successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel booking.");
    }
  };

  if (loading)
    return <div className="text-center py-10 text-gray-500">Loading booking history...</div>;
  if (error) return <div className="text-red-600 text-center py-10">{error}</div>;
  if (!bookings.length)
    return <div className="text-center py-10 text-gray-500">No booking history found.</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <Toaster position="top-right" />
      <h2 className="text-4xl font-bold text-gray-900 text-center mb-6">Your Booking History</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {bookings.map((booking) => (
          <div
            key={booking.id}
            className="bg-gradient-to-tr from-white to-blue-50 shadow-lg rounded-2xl overflow-hidden border border-gray-200 transform transition duration-300 hover:scale-105 hover:shadow-2xl"
          >
            {/* Header: Service & Status */}
            <div className="px-5 py-4 flex justify-between items-center bg-blue-100 border-b border-gray-200">
              <h3 className="font-bold text-xl text-gray-800">{booking.service?.service_type || booking.service}</h3>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold transition duration-300 transform ${
                  booking.status === "booked"
                    ? "bg-yellow-200 text-yellow-800 animate-pulse"
                    : booking.status === "completed"
                    ? "bg-green-200 text-green-800"
                    : booking.status === "in_progress"
                    ? "bg-blue-200 text-blue-800"
                    : "bg-red-200 text-red-800"
                }`}
              >
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>
            </div>

            {/* Worker Info */}
            <div className="flex items-center px-5 py-4 gap-4">
              <img
                src={booking.worker?.avatar ? `${MEDIA_BASE_URL}${booking.worker.avatar}` : "/placeholder.png"}
                alt={booking.worker?.name}
                className="w-16 h-16 rounded-full object-cover border border-gray-300 shadow-sm transition duration-500 hover:scale-110"
              />
              <div>
                <p className="font-semibold text-gray-700 text-lg">{booking.worker?.user?.name || booking.worker?.name || "Unknown Worker"}</p>
                <p className="text-gray-500 text-sm mt-1">Booked on {new Date(booking.booking_time).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Job Description */}
            <div className="px-5 py-3 border-t border-gray-100 border-b bg-white">
              <p className="font-semibold text-gray-700 mb-1">Job Description:</p>
              <p className="text-gray-600 text-sm whitespace-pre-wrap">{booking.details || "N/A"}</p>
            </div>

            {/* Photos */}
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="font-semibold text-gray-700 mb-2">Photos:</p>
              <div className="flex space-x-2 overflow-x-auto">
                {booking.photos?.length > 0 ? (
                  booking.photos.map((photo) => {
                    if (!photo.image_url) return null;
                    const relativePath = photo.image_url.startsWith("/") ? photo.image_url.slice(1) : photo.image_url;
                    const src = relativePath.startsWith("http") ? relativePath : `${MEDIA_BASE_URL}${relativePath}`;
                    return (
                      <img
                        key={photo.id}
                        src={src}
                        alt={`Booking photo ${photo.id}`}
                        className="w-20 h-20 object-cover rounded-lg border shadow-sm transition duration-500 hover:scale-110"
                      />
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-sm">No photos uploaded</p>
                )}
              </div>
            </div>

            {/* Tariffs */}
            <div className="px-5 py-3 border-b border-gray-100 bg-white">
              <p className="font-semibold text-gray-700 mb-2">Tariff Details:</p>
              {booking.tariffs?.length > 0 ? (
                booking.tariffs.map((t, idx) => (
                  <div key={idx} className="flex justify-between text-gray-600 text-sm py-1">
                    <span>{t.label}</span>
                    <span>{t.amount} coins</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No tariff details available</p>
              )}
              <div className="mt-2 font-bold text-gray-800 text-lg">Total: {booking.total || 0} coins</div>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 flex flex-wrap gap-3">
              {cancelVisible[booking.id] && booking.status !== "cancelled" && (
                <button
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transform transition duration-300 hover:scale-105"
                  onClick={() => cancelBooking(booking.id)}
                >
                  Cancel Booking
                </button>
              )}

              {!booking.payment_received && booking.status === "in_progress" && booking.tariffs?.length > 0 && (
                <button
                  onClick={() => setSelectedBooking(booking)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transform transition duration-300 hover:scale-105"
                >
                  Pay Now
                </button>
              )}

              {(booking.payment_status === "paid" || booking.status === "completed") && !booking.rating && (
                <button
                  onClick={() => setSelectedBooking(booking)}
                  className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold hover:bg-yellow-600 transform transition duration-300 hover:scale-105"
                >
                  Provide Rating
                </button>
              )}

              {booking.payment_received && <span className="text-green-600 font-semibold">Payment Successful!</span>}
              {booking.rating && <span className="text-gray-700 font-medium">Your Rating: {booking.rating} ★</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      {selectedBooking && (
        <PaymentOptions
          booking={selectedBooking}
          onPaymentSuccess={() => {
            setSelectedBooking(null);
            fetchBookingHistory();
          }}
          onCancel={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}

// SettingsTab component (unchanged except small fix for data rendering)
function SettingsTab({ userInfo, onSave }) {
  const [formData, setFormData] = useState({
    username: userInfo.username || "",
    phone: userInfo.phone || "",
    address: userInfo.address || "",
    locationLat: userInfo.location?.coordinates?.[1] || "",
    locationLon: userInfo.location?.coordinates?.[0] || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      username: userInfo.username || "",
      phone: userInfo.phone || "",
      address: userInfo.address || "",
      locationLat: userInfo.location?.coordinates?.[1] || "",
      locationLon: userInfo.location?.coordinates?.[0] || "",
    });
  }, [userInfo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      alert("Profile updated.");
    } catch {
      alert("Failed to save profile.");
    }
    setSaving(false);
  };

  return (
    <section className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block font-semibold mb-1">Name</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Phone</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Address</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Latitude</label>
          <input
            type="number"
            name="locationLat"
            step="any"
            value={formData.locationLat}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Longitude</label>
          <input
            type="number"
            name="locationLon"
            step="any"
            value={formData.locationLon}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <button
          disabled={saving}
          onClick={handleSave}
          type="button"
          className={`bg-blue-600 text-white px-4 py-2 rounded font-semibold ${
            saving ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </section>
  );
}

// Main UserHomepage component
function UserHomepage() {
  const [activeTab, setActiveTab] = useState("home");
  const [recommendedWorkers, setRecommendedWorkers] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [bookingWorker, setBookingWorker] = useState(null);
  const [userInfo, setUserInfo] = useState({
    username: "",
    email: "",
    id: null,
    phone: "",
    address: "",
    location: null,
  });
  const [selectedBookingId, setSelectedBookingId] = useState(null); // New state for selected booking details
const onToggleAvailability = async (workerId, newAvailability) => {
  try {
    const csrftoken = getCookie("csrftoken");
    await axios.post(
      "http://localhost:8000/api/worker/availability/",
      { available: newAvailability, workerId },
      { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
    );

    setRecommendedWorkers((prev) =>
      prev.map((w) => (w.id === workerId ? { ...w, available: newAvailability } : w))
    );
  } catch (error) {
    alert("Failed to update availability");
  }
};

  useEffect(() => {
    async function fetchCSRF() {
      try {
        await axios.get("http://localhost:8000/api/csrf/", { withCredentials: true });
      } catch (err) {
        console.error("Failed to fetch CSRF cookie:", err);
      }
    }
    fetchCSRF();
  }, []);

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const response = await axios.get("http://localhost:8000/api/user-profile/", {
          withCredentials: true,
        });
        const data = response.data;
        setUserInfo({
          username: data.username || (data.email ? data.email.split("@")[0] : "User"),
          email: data.email || "",
          id: data.id || null,
          phone: data.phone || "",
          address: data.address || "",
          location: data.location || null,
        });
      } catch (error) {
        console.error("Failed to fetch user profile:", error);
        setUserInfo({ username: "Guest", email: "", id: null, phone: "", address: "", location: null });
      }
    }
    fetchUserProfile();
  }, []);

  useEffect(() => {
  if (!userInfo.id) return;

  async function fetchRecommendations() {
    setLoadingRecs(true);
    try {
      const response = await axios.get(`http://localhost:8000/api/recommend/${userInfo.id}/`, {
        withCredentials: true,
      });
      if (!response.data?.recommendations?.length) {
        setRecommendedWorkers([]);
        setLoadingRecs(false);
        return;
      }
      const workers = response.data.recommendations.map((w) => ({
        id: w.worker_id,
        name: w.worker_name || `Worker ${w.worker_id}`,
        service: { service_type: w.service_name || "Service" },
        avatar: w.avatar_url || `https://i.pravatar.cc/80?u=${w.worker_id}`,
        rating: w.total_rating || 0,
        costPerHour: w.charge || 0,
        difficulty: "Medium",
        description: w.description || "",
       available: w.is_available === false ? false : true,
 // forces unavailable state for testing

 // use actual availability from backend if provided
      }));
    console.log("Mapped workers with availability:", workers); 
      setRecommendedWorkers(workers);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      setRecommendedWorkers([]);
    } finally {
      setLoadingRecs(false);
    }
  }

  fetchRecommendations();

  const intervalId = setInterval(fetchRecommendations, 10000); // poll every 10 seconds

  return () => clearInterval(intervalId); // cleanup on unmount
}, [userInfo.id]);

  async function handleSaveUserProfile(newData) {
    try {
      const csrfToken = getCookie("csrftoken");
      await axios.post("http://localhost:8000/api/user-profile/", newData, {
        withCredentials: true,
        headers: { "X-CSRFToken": csrfToken },
      });
      alert("Profile updated");
    } catch (error) {
      alert("Failed to update profile");
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 relative">
      <header className="mb-6 flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {userInfo.username || "Guest"}</h1>
          {userInfo.id && <p className="text-gray-600">User ID: {userInfo.id}</p>}
        </div>
        <nav className="space-x-4">
          <button
            className={`px-3 py-1 font-semibold ${activeTab === "home" ? "border-b-2 border-blue-600" : ""}`}
            onClick={() => setActiveTab("home")}
            type="button"
          >
            Home
          </button>
          <button
            className={`px-3 py-1 font-semibold ${activeTab === "bookingHistory" ? "border-b-2 border-blue-600" : ""}`}
            onClick={() => setActiveTab("bookingHistory")}
            type="button"
          >
            Booking History
          </button>
          <button
            className={`px-3 py-1 font-semibold ${activeTab === "settings" ? "border-b-2 border-blue-600" : ""}`}
            onClick={() => setActiveTab("settings")}
            type="button"
          >
            Settings
          </button>
        </nav>
      </header>

      {activeTab === "home" && (
        <HomeTab
  onBook={setBookingWorker}
  recommendedWorkers={recommendedWorkers}
  loading={loadingRecs}
  onToggleAvailability={onToggleAvailability}  // pass this if implemented
/>

      )}

      {activeTab === "bookingHistory" && (
        <>
          <BookingHistory onShowDetails={(id) => setSelectedBookingId(id)} />
          {/* Show BookingDetails modal or panel when a booking is selected */}
          {selectedBookingId && (
            <BookingDetails bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
          )}
        </>
      )}

      {activeTab === "settings" && <SettingsTab userInfo={userInfo} onSave={handleSaveUserProfile} />}

      {/* Booking modal/card when bookingWorker is set */}
      {bookingWorker && (
        <UserBooking worker={bookingWorker} userId={userInfo.id} onClose={() => setBookingWorker(null)} />
      )}
    </div>
  );
}

export default UserHomepage;