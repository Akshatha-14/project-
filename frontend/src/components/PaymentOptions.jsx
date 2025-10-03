import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

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

function PaymentOptions({ booking = {}, onPaymentSuccess, onCancel, onMarkCompleted }) {
  const [bookingDetails, setBookingDetails] = useState(booking);
  const [loading, setLoading] = useState(!booking?.id);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null); // "online" or "cod"
  const [userRating, setUserRating] = useState(booking?.rating ?? 0);
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    if (!booking?.id) return;

    async function fetchBookingDetails() {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(
          `http://localhost:8000/api/user/bookings/${booking.id}/`,
          { withCredentials: true }
        );
        setBookingDetails(response.data);
        setUserRating(response.data.rating ?? 0);
      } catch (err) {
        console.error("Error fetching booking details:", err);
        setError("Failed to load booking details.");
      } finally {
        setLoading(false);
      }
    }

    fetchBookingDetails();
  }, [booking]);

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (document.getElementById("razorpay-script")) return resolve(true);
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleRazorpayPayment = async () => {
    if (!bookingDetails?.tariff_coins) return toast.error("Booking details not loaded.");
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) return toast.error("Failed to load Razorpay SDK.");

    const amount = Number(bookingDetails?.tariff_coins || 0) + Number(bookingDetails?.admin_commission_coins || 0);
    const csrftoken = getCookie("csrftoken");

    try {
      const { data } = await axios.post(
        "http://localhost:8000/api/payment/create_order/",
        { bookingId: bookingDetails.id, amount },
        { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
      );

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "Local Service Finder",
        order_id: data.order_id,
        handler: async (response) => {
          try {
            await axios.post(
              "http://localhost:8000/api/payment/verify/",
              {
                bookingId: bookingDetails.id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              },
              { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
            );
            toast.success("Payment successful!");
            onPaymentSuccess();
          } catch (err) {
            console.error("Payment verification failed:", err);
            toast.error("Payment verification failed.");
          }
        },
        prefill: {},
        theme: { color: "#2563eb" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Error creating Razorpay order:", err);
      toast.error("Payment failed to start.");
    }
  };

  const handleCOD = async () => {
    const csrftoken = getCookie("csrftoken");
    try {
      await axios.post(
        "http://localhost:8000/api/payment/cod/",
        { bookingId: bookingDetails?.id },
        { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
      );
      toast.success("COD selected. Worker notified!");
      onPaymentSuccess();
    } catch (err) {
      console.error("Failed to set COD:", err);
      toast.error("Failed to set payment method to COD");
    }
  };

  const handleMarkCompleted = async () => {
    if (!bookingDetails?.id) return;
    const csrftoken = getCookie("csrftoken");
    try {
      await axios.post(
        "http://localhost:8000/api/worker/job/complete/",
        { jobId: bookingDetails.id },
        { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
      );
      toast.success("Job marked as completed.");
      onMarkCompleted?.();
    } catch (error) {
      console.error("Failed to mark job complete:", error);
      toast.error("Failed to mark job complete.");
    }
  };

  const handleSubmitRating = async (selectedRating) => {
    if (!bookingDetails?.id) return;
    setSubmittingRating(true);
    const csrftoken = getCookie("csrftoken");
    try {
      await axios.post(
        "http://localhost:8000/api/rating/submit/",
        { booking: bookingDetails.id, rating: selectedRating },
        { withCredentials: true, headers: { "X-CSRFToken": csrftoken } }
      );
      setUserRating(selectedRating);
      toast.success("Rating submitted successfully!");
    } catch (err) {
      console.error("Failed to submit rating:", err);
      toast.error("Failed to submit rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const renderStarRating = () => {
    const stars = [1, 2, 3, 4, 5];
    return (
      <div className="flex justify-center space-x-2 mt-2">
        {stars.map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleSubmitRating(star)}
            disabled={submittingRating}
            className={`transition-transform transform hover:scale-125 text-3xl ${
              userRating >= star ? "text-yellow-400" : "text-gray-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  if (loading)
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
        <div className="p-6 animate-pulse bg-gray-100 rounded-lg shadow-md w-96">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-3"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg w-96">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <button onClick={onCancel} className="mt-2 bg-red-600 text-white py-1 px-3 rounded">
            Close
          </button>
        </div>
      </div>
    );

  const {
    worker = {},
    service = {},
    tariff_coins = 0,
    admin_commission_coins = 0,
    status = "N/A",
    payment_status = "Pending",
  } = bookingDetails || {};

  const workerName = worker.name ?? worker.user?.name ?? "Unknown Worker";
  const serviceName = service.name ?? bookingDetails?.service_type ?? "Unknown Service";
  const totalAmount = Number(tariff_coins) + Number(admin_commission_coins);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="p-5 bg-white rounded-xl shadow-lg max-w-md w-full space-y-4 relative">
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold"
        >
          &times;
        </button>

        <h2 className="text-xl font-bold text-center mb-3">Payment & Rating</h2>

        <div className="space-y-2">
          <p><strong>Service:</strong> {serviceName}</p>
          <p><strong>Worker:</strong> {workerName}</p>
          <p><strong>Tariff:</strong> ₹{tariff_coins}</p>
          {admin_commission_coins > 0 && <p><strong>Commission:</strong> ₹{admin_commission_coins}</p>}
          <p className="text-lg font-semibold"><strong>Total:</strong> ₹{totalAmount}</p>
          <p><strong>Status:</strong> {status}</p>
          <p><strong>Payment:</strong> {payment_status.toUpperCase()}</p>
        </div>

        <div className="space-y-2">
          {payment_status === "paid" && status !== "completed" && (
            <button
              onClick={handleMarkCompleted}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Mark Job Completed
            </button>
          )}

          {!paymentMethod && payment_status !== "paid" && (
            <>
              <button
                onClick={() => setPaymentMethod("online")}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Pay Online
              </button>
              {worker.allows_cod && (
                <button
                  onClick={() => setPaymentMethod("cod")}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Cash on Delivery
                </button>
              )}
              <button
                onClick={onCancel}
                className="w-full bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {paymentMethod === "online" && (
            <>
              <p className="text-center font-semibold">Proceed with Online Payment ₹{totalAmount}</p>
              <button
                onClick={handleRazorpayPayment}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Pay Now
              </button>
              <button
                onClick={() => setPaymentMethod(null)}
                className="w-full bg-gray-300 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Back
              </button>
            </>
          )}

          {paymentMethod === "cod" && (
            <>
              <p className="text-center font-semibold">Confirm Cash on Delivery</p>
              <button
                onClick={handleCOD}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Confirm COD
              </button>
              <button
                onClick={() => setPaymentMethod(null)}
                className="w-full bg-gray-300 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Back
              </button>
            </>
          )}
        </div>

        {payment_status === "paid" && (
          <div>
            <h3 className="mt-4 text-center font-semibold">Rate Your Service</h3>
            <p className="text-center text-sm text-gray-500 mb-2">Click stars to submit/update rating</p>
            {renderStarRating()}
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentOptions;
