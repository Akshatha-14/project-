import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import forge from "node-forge";

// Utility: Get CSRF token
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(name + "=")) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Replace with exact backend RSA public key PEM
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

// Encrypt data field with AES-CBC, base64 (forge)
function aesEncrypt(data, aesKeyBytes) {
  // Generate a random IV (16 bytes)
  const iv = forge.random.getBytesSync(16);

  // Encode message in UTF-8
  const buffer = forge.util.createBuffer(data, "utf8");

  const cipher = forge.cipher.createCipher("AES-CBC", aesKeyBytes);
  cipher.start({ iv: iv });
  cipher.update(buffer);
  cipher.finish();

  // Concatenate IV + ciphertext
  const encrypted = iv + cipher.output.getBytes();

  // Return base64
  return forge.util.encode64(encrypted);
}

// Encrypt AES session key with RSA public key (OAEP)
function encryptAESKeyWithRSA(aesKeyBytes) {
  const publicKey = forge.pki.publicKeyFromPem(RSA_PUBLIC_KEY_PEM);
  const encryptedKey = publicKey.encrypt(aesKeyBytes, "RSA-OAEP");
  return forge.util.encode64(encryptedKey);
}

export default function ProfileCompletionPage() {
  const [formData, setFormData] = useState({
    address: "",
    phone: "",
    location: null, // [lat, lng]
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("http://localhost:8000/api/csrf/", { withCredentials: true }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    axios
      .get("http://localhost:8000/api/user-profile/", { withCredentials: true })
      .then((res) => {
        const data = res.data;
        setFormData({
          address: data.address || "",
          phone: data.phone || "",
          location: data.location && data.location.coordinates
            ? [data.location.coordinates[1], data.location.coordinates]
            : null,
        });
      })
      .catch(() => setError("Failed to load profile info."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!formData.location && !loading && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latLng = [position.coords.latitude, position.coords.longitude];
          setFormData((f) => ({ ...f, location: latLng }));
          setError("");
        },
        () => setError("Could not fetch location. Please enable GPS or enter manually."),
        { enableHighAccuracy: true }
      );
    }
  }, [formData.location, loading]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!formData.address.trim()) {
      setError("Address is required");
      return false;
    }
    if (!formData.phone.trim()) {
      setError("Phone number is required");
      return false;
    }
    if (!formData.location) {
      setError("Location must be set or allowed on the map");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setSubmitting(true);
    try {
      // Generate a random AES key (32 bytes)
      const aesKeyBytes = forge.random.getBytesSync(32);

      // Encrypt each field
      const encryptedAddress = aesEncrypt(formData.address, aesKeyBytes);
      const encryptedPhone = aesEncrypt(formData.phone, aesKeyBytes);
      const encryptedLocation = aesEncrypt(
  JSON.stringify({
    type: "Point",
    coordinates: [formData.location[1], formData.location[0]],  // Correct order: [lng, lat]
  }),
  aesKeyBytes
);

      // RSA encrypt the AES key
      const encryptedAESKey = encryptAESKeyWithRSA(aesKeyBytes);

      // POST encrypted payload
      await axios.post(
        "http://localhost:8000/api/user-profile/",
        {
          key: encryptedAESKey,
          data: {
            address: encryptedAddress,
            phone: encryptedPhone,
            location: encryptedLocation,
          },
        },
        {
          withCredentials: true,
          headers: { "X-CSRFToken": getCookie("csrftoken") },
        }
      );

      navigate("/userhome");
    } catch (error) {
      if (error.response && error.response.data) {
        setError(error.response.data.error || JSON.stringify(error.response.data));
      } else {
        setError("Failed to update profile. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="w-full flex justify-center py-8">Loading profile...</div>;
  }

  return (
    <div className="max-w-xl mx-auto mt-10 px-4 py-7 border rounded-lg shadow-lg bg-white">
      <h2 className="text-xl font-semibold mb-4">Complete Profile</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block mt-3">
          Address
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="w-full mt-2 px-2 py-2 border rounded"
            required
          />
        </label>
        <label className="block mt-3">
          Phone Number
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full mt-2 px-2 py-2 border rounded"
            required
          />
        </label>
        <div className="mt-4">
          <div className="mb-2">Set Location</div>
          <div style={{ height: "220px", width: "100%" }}>
            {formData.location && (
              <MapContainer
  center={formData.location}
  zoom={15}
  scrollWheelZoom={false}
  style={{ height: "100%", width: "100%" }}
  whenCreated={(map) => {
    map.on("click", function (e) {
      const { lat, lng } = e.latlng;
      setFormData((f) => ({ ...f, location: [lat, lng] }));
      setError("");
    });
  }}
>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {formData.location && <Marker position={formData.location} />}
</MapContainer>

            )}
          </div>
          <button
            type="button"
            onClick={() => setFormData((f) => ({ ...f, location: null }))}
            className="mt-2 px-4 py-1 text-xs border rounded text-red-700"
          >
            Reset Location
          </button>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-6 bg-blue-600 text-white py-2 rounded shadow"
        >
          {submitting ? "Submitting..." : "Save Profile"}
        </button>
      </form>
    </div>
  );
}
