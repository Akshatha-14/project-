import React, { useState, useEffect } from "react";
import axios from "axios";

// Helper to read CSRF token cookie for Django CSRF protection
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
function WorkerSettingsTab({ settings, setSettings, onSave }) {
  return (
    <section className="max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4 text-[#143c5]">Settings</h2>
      <div className="bg-white rounded-2xl p-6 shadow border border-gray-200 space-y-5">
        <div className="flex items-center gap-4">
          {settings.avatar && (
            <img
              src={typeof settings.avatar === "string" ? settings.avatar : URL.createObjectURL(settings.avatar)}
              alt="Worker Avatar"
              className="w-16 h-16 rounded-full object-cover border-2 border-[#2566eb]"
            />
          )}
          <label>
            <span className="block font-semibold text-[#143c5] mb-1">Change Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSettings((prev) => ({ ...prev, avatar: e.target.files[0] }))}
            />
          </label>
        </div>
        <label className="block">
          <span className="font-semibold text-[#143c5] mb-1">Name</span>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 rounded"
            value={settings.name}
            onChange={(e) => setSettings((prev) => ({ ...prev, name: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="font-semibold text-[#143c5] mb-1">Email</span>
          <input
            type="email"
            className="w-full p-2 border border-gray-300 rounded"
            value={settings.email}
            onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="font-semibold text-[#143c5] mb-1">Contact Number</span>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 rounded"
            value={settings.contactNumber || ""}
            onChange={(e) => setSettings((prev) => ({ ...prev, contactNumber: e.target.value }))}
          />
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={settings.notifyEmail}
            onChange={() => setSettings((prev) => ({ ...prev, notifyEmail: !prev.notifyEmail }))}
          />
          <span className="ml-2 font-semibold text-[#143c5]">Email Notifications</span>
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={settings.notifySMS}
            onChange={() => setSettings((prev) => ({ ...prev, notifySMS: !prev.notifySMS }))}
          />
          <span className="ml-2 font-semibold text-[#143c5]">SMS Notifications</span>
        </label>
        <button
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          onClick={onSave}
        >
          Save Settings
        </button>
      </div>
    </section>
  );
}

function WorkerNavbar({ username, coinBalance, avatar, activeTab, onTabChange, available, toggleAvailability }) {
  const tabs = [
    { id: "home", label: "Home" },
    { id: "job", label: "Current Job" },
    { id: "earnings", label: "Earnings" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <header className="bg-gradient-to-r from-[#14305c] via-[#2563eb] to-[#14305c] text-white p-5 shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={avatar} alt={username} className="w-10 h-10 rounded-full border-2 border-[#2563eb] shadow-md object-cover" />
          <div>
            <span className="text-lg font-bold">{username}</span>
            <div className="text-xs text-blue-200">Worker Panel</div>
          </div>
          {/* Availability toggle button */}
          <button
            onClick={toggleAvailability}
            className={`ml-4 px-3 py-1 rounded font-semibold transition ${
              available ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            }`}
            title={available ? "Mark Unavailable" : "Mark Available"}
          >
            {available ? "Available" : "Unavailable"}
          </button>
        </div>
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`font-semibold px-4 py-2 rounded transition ${
                activeTab === tab.id ? "bg-[#2563eb] text-white shadow-lg" : "hover:bg-[#14305c] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        
      </div>
    </header>
  );
}

function HomeTab({ settings, activeJob, totalBookings, avgRating, ratingCount, pendingRequests, onAccept }) {
  const [avatarURL, setAvatarURL] = useState(null);

  useEffect(() => {
    if (!settings) {
      setAvatarURL(null);
      return;
    }
    if (typeof settings.avatar === "string" && settings.avatar.trim() !== "") {
      setAvatarURL(settings.avatar);
      return;
    }
    if (settings.avatar instanceof Blob) {
      const url = URL.createObjectURL(settings.avatar);
      setAvatarURL(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setAvatarURL(null);
  }, [settings]);

  return (
    <section className="max-w-4xl mx-auto p-6 text-center">
      <h2 className="text-4xl font-bold text-[#14305c] mb-3">Welcome, {settings.name}!</h2>
      <div className="flex gap-8 justify-center mb-8">
        <div className="bg-white rounded-lg px-6 py-3 shadow">
          <span className="block text-blue-900 font-semibold text-lg">Bookings</span>
          <span className="text-2xl text-[#2563eb] font-bold">{totalBookings}</span>
        </div>
        <div className="bg-white rounded-lg px-6 py-3 shadow">
          <span className="block text-blue-900 font-semibold text-lg">Rating</span>
          <span className="text-2xl text-yellow-500 font-bold">{avgRating}</span>
          <span className="block text-xs text-gray-600">{ratingCount} reviews</span>
        </div>
      </div>
      {avatarURL && (
        <img
          src={avatarURL}
          alt="worker"
          className="mx-auto w-24 h-24 rounded-full border-4 border-[#2563eb] object-cover mb-4"
        />
      )}
      <div className="mt-4 font-medium text-gray-600">
        {activeJob ? (
          <>
            You are currently working on: <span className="text-[#2563eb] font-bold">{activeJob.service.service_type}</span>
          </>
        ) : (
          <>
            You are <span className="text-[#2563eb] font-bold">Available</span> for new jobs!
          </>
        )}
      </div>

      {/* Pending requests list */}
      {!activeJob && pendingRequests && pendingRequests.length > 0 && (
        <div className="mt-8 text-left">
          <h3 className="text-xl font-semibold mb-3 text-[#14305c]">Pending Job Requests</h3>
          <ul>
            {pendingRequests.map((job) => (
              <li key={job.id} className="bg-white rounded shadow p-3 mb-3 flex justify-between items-center">
                <span>
                  {job.service.service_type} for {job.user.name}
                </span>
                <button
                  onClick={() => onAccept(job.id)}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Accept Job
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}



function CurrentJobTab({
  activeJob,
  onComplete,
  onConfirmCodPayment,
  onEditTariff,
  paymentStatus,
  onPay,
}) {
  if (!activeJob)
    return (
      <section className="max-w-2xl mx-auto p-6 text-center">
        <h2 className="text-2xl font-bold text-[#14305c] mb-4">No Active Job</h2>
        <div className="bg-white p-5 rounded-xl shadow text-blue-900 font-medium">
          Available for booking.
        </div>
      </section>
    );

  const { payment_method, payment_received, payment_status, status } = activeJob;

  return (
    <section className="max-w-2xl mx-auto p-6">
      {/* Job details section */}
      <div className="font-bold text-lg mb-2">
        {activeJob.service?.service_type} for {activeJob.user?.name}
      </div>

      <div>
        <b>Address:</b> {activeJob.user?.address || "N/A"}
      </div>

      <div>
        <b>Location:</b>{" "}
        {activeJob.job_location ? (
          <a
            href={`https://www.google.com/maps?q=${activeJob.job_location.coordinates[1]},${activeJob.job_location.coordinates[0]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline"
          >
            Lat {activeJob.job_location.coordinates[1]}, Lng {activeJob.job_location.coordinates[0]}
          </a>
        ) : (
          <span>No location available</span>
        )}
      </div>

      <div>
        <b>Phone:</b> {activeJob.user?.phone || "N/A"}
      </div>

      <div>
        <b>Date:</b>{" "}
        {activeJob.booking_time ? new Date(activeJob.booking_time).toLocaleString() : "N/A"}
      </div>

      {/* Tariff editor sub-component */}
      <TariffEditor
  activeJob={activeJob}
  tariff={activeJob.tariffs || []} // corrected to plural or whatever backend returns
  setTariff={onEditTariff}
  paymentStatus={paymentStatus}
  receiptSent={activeJob.receipt_sent} // consistent prop name
  onSendReceipt={onPay}
  basePrice={activeJob.service?.base_price || 0}
/>


      {/* Button to confirm COD payment if applicable */}
      {payment_method === "cod" && !payment_received && (
        <button
          className="bg-yellow-500 text-white px-4 py-2 rounded mt-4 font-semibold"
          onClick={onConfirmCodPayment}
        >
          Confirm COD Payment Received
        </button>
      )}

      {/* Mark job complete button shown only if payment confirmed and job not completed */}
      {payment_status === "paid" && status !== "completed" && (
        <button
          className="bg-emerald-600 text-white px-4 py-2 rounded mt-4 font-semibold"
          onClick={onComplete}
        >
          Mark Job Complete
        </button>
      )}

      {/* Display message when job is completed */}
      {status === "completed" && (
        <div className="p-3 mt-4 rounded bg-green-100 text-green-800 font-semibold">
          Job Completed
        </div>
      )}
    </section>
  );
}



function EarningsTab({ earnings }) {
  return (
    <section className="max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6 text-[#14305c]">Earnings</h2>
      {earnings.length === 0 && <p className="text-gray-600">No jobs completed yet.</p>}
      {earnings.map((earning) => (
        <div key={earning.id} className="bg-white rounded-xl shadow border border-gray-200 mb-6 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-bold text-[#2563eb]">{earning.service?.service_type || earning.service?.name || "Unknown Service"}</span>
              <span className="text-gray-600 ml-4">{earning.customer || "Unknown Customer"}</span>
            </div>
            <div className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold text-sm">
              +{earning.amount || 0} coins
            </div>
          </div>
          <div className="mb-1">
            <b>Date:</b> {earning.date ? new Date(earning.date).toLocaleDateString() : "N/A"}
          </div>
          <div className="mb-1">
            <b>Location:</b> {earning.address || "Location not provided"}
          </div>
          <div className="mb-1">
            <b>Rating:</b> <span className="text-yellow-500 font-bold">{earning.rating ?? "—"}</span>
          </div>
          {earning.tarif && earning.tarif.length > 0 && (
            <div className="mb-1 text-sm text-gray-700">
              {earning.tarif.map((t, i) => (
                <span key={i} className="inline-block pr-4">
                  {t.label}: {t.amount}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}


function TariffEditor({ activeJob, tariff, setTariff, paymentStatus, receiptSent, onSendReceipt, basePrice }) {
  const [localTariff, setLocalTariff] = React.useState(tariff || []);
  const [unsavedChanges, setUnsavedChanges] = React.useState(false);

  React.useEffect(() => {
    setLocalTariff(tariff || []);
    setUnsavedChanges(false);
  }, [tariff]);

  // Disable controls if payment is done or receipt is sent
  const disableControls = paymentStatus === "paid" || receiptSent;

  // Allow send receipt button if payment not done and receipt not sent, irrespective of unsaved changes
  const canSendReceipt = !disableControls;

  const handleSendReceipt = async () => {
    if (disableControls) return;

    await setTariff(localTariff);
    setUnsavedChanges(false);

    if (onSendReceipt) {
      // Pass current tariff list to parent callback
      await onSendReceipt(localTariff);
    }
  };

  const handleAddItem = () => {
    setUnsavedChanges(true);
    setLocalTariff([...localTariff, { label: "", amount: 0, explanation: "" }]);
  };

  const handleChange = (idx, field, value) => {
    setUnsavedChanges(true);
    setLocalTariff(localTariff.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const handleDelete = (idx) => {
    setUnsavedChanges(true);
    setLocalTariff(localTariff.filter((_, i) => i !== idx));
  };

  const total = localTariff.reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number(basePrice);

  return (
    <div className="my-3 p-4 rounded border border-gray-200 bg-gray-50">
      <h4 className="font-bold mb-2 text-[#14305c]">Tariff Receipt</h4>

      {localTariff.map((item, idx) => (
        <div key={idx} className="flex gap-2 items-center mb-2">
          <input
            type="text"
            value={item.label}
            placeholder="Label"
            onChange={(e) => handleChange(idx, "label", e.target.value)}
            className="border px-2 py-1 rounded w-1/5"
            disabled={disableControls}
          />
          <input
            type="number"
            value={item.amount}
            placeholder="Amount"
            onChange={(e) => handleChange(idx, "amount", e.target.value)}
            className="border px-2 py-1 rounded w-1/5"
            disabled={disableControls}
          />
          <input
            type="text"
            value={item.explanation}
            placeholder="Explanation"
            onChange={(e) => handleChange(idx, "explanation", e.target.value)}
            className="border px-2 py-1 rounded flex-1"
            disabled={disableControls}
          />
          {!disableControls && (
            <button className="text-red-600" onClick={() => handleDelete(idx)}>
              Delete
            </button>
          )}
        </div>
      ))}

      {!disableControls && (
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={handleAddItem}>
          Add Line
        </button>
      )}

      <div className="font-bold mt-4">
        Total: <span className="text-[#2563eb]">{total} coins</span>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          className={`px-4 py-2 rounded text-white ${
            canSendReceipt ? "bg-[#2563eb] hover:bg-[#1e4bb8]" : "bg-gray-400 cursor-not-allowed"
          }`}
          onClick={handleSendReceipt}
          disabled={!canSendReceipt}
        >
          Send Receipt (Pay)
        </button>
      </div>

      {paymentStatus === "paid" && (
        <div className="mt-4 p-2 rounded bg-green-100 text-green-800 font-semibold text-center">
          Payment Successful!
        </div>
      )}
    </div>
  );
}

function WorkerHomepage() {
  const [activeTab, setActiveTab] = useState("home");
  const [activeJob, setActiveJob] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [settings, setSettings] = useState(null);
  const [available, setAvailable] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completingJob, setCompletingJob] = useState(false);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [tariff, setTariff] = useState([]);

  const receiptSent = activeJob?.receipt_sent || false;
  const disableEditing = paymentStatus === "paid" || receiptSent;

  useEffect(() => {
    const csrftoken = getCookie("csrftoken");

    async function fetchHomepageData() {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get("http://localhost:8000/api/worker/homepage/", {
          withCredentials: true,
          headers: { "X-CSRFToken": csrftoken },
        });
        const data = response.data;
        setActiveJob(data.activeJob);
        setPendingRequests(data.pendingRequests || []);
        setEarnings(data.earnings || []);
        setSettings(data.settings);
        setAvailable(data.available);
        setPaymentStatus(data.activeJob?.payment_status || "pending");
        setTariff(data.activeJob?.tariffs || []);
      } catch (error) {
        setError("Failed to load homepage data.");
      } finally {
        setLoading(false);
      }
    }

    fetchHomepageData();
  }, []);

  const toggleAvailability = async () => {
    if (activeJob) return;
    const csrftoken = getCookie("csrftoken");
    try {
      const response = await axios.post(
        "http://localhost:8000/api/worker/availability/",
        { available: !available },
        { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
      );
      setAvailable(response.data.available);
    } catch (error) {
      console.error("Error updating availability", error);
    }
  };

  const handleAcceptJob = async (jobId) => {
    if (activeJob || !available) return;
    const csrftoken = getCookie("csrftoken");
    try {
      const response = await axios.post(
        "http://localhost:8000/api/worker/job/accept/",
        { jobId },
        { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
      );
      setActiveJob(response.data);
      setPendingRequests((prev) => prev.filter((r) => r.id !== jobId));
      setAvailable(false);
      setPaymentStatus("pending");
      setTariff(response.data.tariffs || []);
      setActiveTab("job");
    } catch (error) {
      console.error("Error accepting job", error);
    }
  };

  const handleCompleteJob = async () => {
    if (!activeJob) {
      alert("No active job to complete.");
      return;
    }
    if (!activeJob.payment_received) {
      alert("Cannot complete job. Payment is pending.");
      return;
    }
    setCompletingJob(true);
    const csrftoken = getCookie("csrftoken");
    try {
      await axios.post(
        "http://localhost:8000/api/worker/job/complete/",
        { jobId: activeJob.id },
        {
          withCredentials: true,
          headers: { "X-CSRFToken": csrftoken },
        }
      );
      alert("Job marked as completed.");
      setEarnings((prev) => [activeJob, ...prev]);
      setActiveJob(null);
      setPaymentStatus("pending");
      setAvailable(true);
      setActiveTab("home");
      setTariff([]);
    } catch (error) {
      alert("Failed to complete job.");
    } finally {
      setCompletingJob(false);
    }
  };

  const handleConfirmCodPayment = async () => {
  if (!activeJob) {
    alert("No active job.");
    return;
  }
  const csrftoken = getCookie("csrftoken");
  try {
    await axios.post(
      "http://localhost:8000/api/worker/confirm_cod_payment/",
      { bookingId: activeJob.id },
      { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
    );
    alert("COD payment confirmed successfully.");
    setActiveJob((prev) => ({
      ...prev,
      payment_received: true,
      payment_status: "paid",
      status: "completed",  // add this line to reflect complete status
    }));
    setPaymentStatus("paid");
  } catch (error) {
    alert("Failed to confirm COD payment.");
  }
};

  const handleEditTariff = async (newTariff) => {
    if (!activeJob) return;
    const csrftoken = getCookie("csrftoken");
    try {
      const response = await axios.put(
        "http://localhost:8000/api/worker/job/tariff/",
        { jobId: activeJob.id, tariff: newTariff },
        { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
      );
      setActiveJob(response.data);
      setPaymentStatus(response.data.payment_status || "pending");
      setTariff(response.data.tariffs || newTariff);
    } catch (error) {
      console.error("Error saving tariff", error);
    }
  };

  const handleSendReceipt = async (updatedTariff) => {
    if (disableEditing) return;
    setSendingReceipt(true);
    const csrftoken = getCookie("csrftoken");
    try {
      // Save tariff first
      await axios.put(
        "http://localhost:8000/api/worker/job/tariff/",
        { jobId: activeJob.id, tariff: updatedTariff },
        { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
      );
      // Send receipt
      await axios.post(
  "http://localhost:8000/api/worker/bookings/send_receipt/",
  { bookingId: activeJob.id },
  { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
);


      // Refresh activeJob to sync state
      const response = await axios.get(
  `http://localhost:8000/api/worker/job/${activeJob.id}/`,
  { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
);
setActiveJob(response.data);
setPaymentStatus(response.data.payment_status || "pending");
setTariff(response.data.tariffs || updatedTariff);

    } catch (error) {
      alert("Failed to send receipt.");
    } finally {
      setSendingReceipt(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner text-center p-6 text-lg text-[#14305c]">
        Loading worker data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message p-6 text-center text-red-600 font-semibold">
        {error}
      </div>
    );
  }

  if (!settings) {
    return <div>No settings data found.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <WorkerNavbar
        username={settings.name}
        avatar={typeof settings.avatar === "string" ? settings.avatar : null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        available={available}
        toggleAvailability={toggleAvailability}
        coinBalance={settings.coinBalance}
      />

      <main className="pt-6 pb-14">
        {activeTab === "home" && (
          <HomeTab
            settings={settings}
            earnings={earnings}
            activeJob={activeJob}
            totalBookings={earnings.length}
            avgRating={
              earnings.length
                ? (
                    earnings.reduce((sum, e) => sum + (e.rating || 0), 0) /
                    earnings.filter((e) => e.rating != null).length
                  ).toFixed(2)
                : "—"
            }
            ratingCount={earnings.filter((e) => e.rating != null).length}
            pendingRequests={pendingRequests}
            onAccept={handleAcceptJob}
          />
        )}

        {activeTab === "job" && (
          <CurrentJobTab
            activeJob={activeJob}
            onComplete={handleCompleteJob}
            onConfirmCodPayment={handleConfirmCodPayment}
            onEditTariff={handleEditTariff}
            paymentStatus={paymentStatus}
            onPay={handleSendReceipt}
            sendingReceipt={sendingReceipt}
            completingJob={completingJob}
          />
        )}

        {activeTab === "earnings" && <EarningsTab earnings={earnings} />}

        {activeTab === "settings" && (
          <WorkerSettingsTab settings={settings} setSettings={setSettings} onSave={() => {}} />
        )}
      </main>
    </div>
  );
}

export default WorkerHomepage;