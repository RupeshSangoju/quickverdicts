"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, HelpCircle, X, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { getToken } from "@/lib/apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";

type Attorney = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lawFirmName: string;
  phoneNumber?: string;
  verified?: boolean;
  verificationStatus?: string;
};

interface AttorneyProfileSectionProps {
  onBack: () => void;
}

export default function AttorneyProfileSection({ onBack }: AttorneyProfileSectionProps) {
  const [attorney, setAttorney] = useState<Attorney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editData, setEditData] = useState({ firstName: "", lastName: "", email: "", phoneNumber: "" });
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Payment methods state
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [paymentMethodType, setPaymentMethodType] = useState<"venmo" | "paypal" | "zelle" | "card">("venmo");
  const [paymentDetails, setPaymentDetails] = useState({
    venmoHandle: "",
    paypalEmail: "",
    zelleEmail: "",
    cardNumber: "",
    cardholderName: "",
    expiryDate: "",
    cvv: ""
  });

  useEffect(() => {
    const fetchAttorney = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getToken();

        if (!token) {
          setError("Authentication token not found. Please login again.");
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/api/attorney/profile`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        });
        if (!res.ok) {
          if (res.status === 401) {
            setError("Session expired. Please login again.");
          } else {
            setError(`Failed to fetch attorney details: ${res.status}`);
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (data.success && data.data?.attorney) {
          const attorneyData = data.data.attorney;
          setAttorney({
            id: attorneyData.AttorneyId || attorneyData.id,
            firstName: attorneyData.FirstName || attorneyData.firstName,
            lastName: attorneyData.LastName || attorneyData.lastName,
            email: attorneyData.Email || attorneyData.email,
            lawFirmName: attorneyData.LawFirmEntityName || attorneyData.LawFirmName || attorneyData.lawFirmName,
            phoneNumber: attorneyData.PhoneNumber || attorneyData.phoneNumber || "",
            verified: attorneyData.IsVerified || attorneyData.verified || false,
            verificationStatus: attorneyData.VerificationStatus || attorneyData.verificationStatus || "pending"
          });
        } else {
          setError("Failed to fetch attorney details");
        }
      } catch (err) {
        setAttorney(null);
        setError("Failed to fetch attorney details");
      } finally {
        setLoading(false);
      }
    };
    fetchAttorney();
  }, []);

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  }

  async function handleEditProfile(e: React.FormEvent) {
    e.preventDefault();
    setUpdating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Basic validation
    if (!editData.firstName.trim() || !editData.lastName.trim()) {
      setErrorMessage("First name and last name are required");
      setUpdating(false);
      return;
    }

    try {
      const token = getToken();

      if (!token) {
        setErrorMessage("Authentication token not found. Please login again.");
        setUpdating(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/attorney/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: editData.firstName,
          lastName: editData.lastName,
          phoneNumber: editData.phoneNumber,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.attorney) {
          setAttorney(data.attorney);
        } else {
          setAttorney(j => j ? { ...j, firstName: editData.firstName, lastName: editData.lastName, phoneNumber: editData.phoneNumber } : j);
        }
        setSuccessMessage("Profile updated successfully!");
        setTimeout(() => {
          setShowEdit(false);
          setSuccessMessage(null);
        }, 1500);
      } else {
        setErrorMessage(data.message || "Failed to update profile");
      }
    } catch (err) {
      setErrorMessage("Failed to update profile. Please try again.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setErrorMessage(null);

    try {
      const token = getToken();

      if (!token) {
        setErrorMessage("Authentication token not found. Please login again.");
        setDeleting(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/attorney/profile`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });
      const data = await res.json();
      if (data.success) {
        // Clear local storage and cookies
        localStorage.removeItem("attorneyUser");
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        window.location.href = "/login";
      } else {
        setErrorMessage(data.message || "Failed to delete account");
        setDeleting(false);
      }
    } catch (err) {
      setErrorMessage("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  }

  // Payment method handlers
  function handleAddPaymentMethod() {
    let methodAdded = "";

    if (paymentMethodType === "venmo" && paymentDetails.venmoHandle.trim()) {
      methodAdded = `Venmo (@${paymentDetails.venmoHandle})`;
    } else if (paymentMethodType === "paypal" && paymentDetails.paypalEmail.trim()) {
      methodAdded = `PayPal (${paymentDetails.paypalEmail})`;
    } else if (paymentMethodType === "zelle" && paymentDetails.zelleEmail.trim()) {
      methodAdded = `Zelle (${paymentDetails.zelleEmail})`;
    } else if (paymentMethodType === "card" && paymentDetails.cardNumber.trim() && paymentDetails.cardholderName.trim()) {
      const lastFour = paymentDetails.cardNumber.slice(-4);
      methodAdded = `Card ending in ${lastFour}`;
    } else {
      setErrorMessage("Please fill in all required fields");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setPaymentMethod(methodAdded);
    setShowAddPayment(false);
    setSuccessMessage(`Payment method added successfully: ${methodAdded}`);
    setTimeout(() => setSuccessMessage(null), 3000);

    // Reset form
    setPaymentDetails({
      venmoHandle: "",
      paypalEmail: "",
      zelleEmail: "",
      cardNumber: "",
      cardholderName: "",
      expiryDate: "",
      cvv: ""
    });
  }

  function handleRemovePaymentMethod() {
    setPaymentMethod(null);
    setSuccessMessage("Payment method removed successfully");
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  if (loading) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
          <div className="animate-spin rounded-full h-20 w-20 border-t-8 border-b-8 border-[#16305B] mb-6" />
          <span className="text-lg text-[#16305B] font-semibold">Loading profile...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <div className="text-red-600 text-xl font-semibold mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#16305B] text-white rounded-lg hover:bg-[#1e417a] transition-colors font-semibold"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen overflow-y-auto p-0">
      <div className="p-8 md:p-10 bg-[#F7F6F3] min-h-screen w-full">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[#16305B] hover:text-[#1e417a] transition-colors group"
              aria-label="Go back to home"
            >
              <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-semibold">Back</span>
            </button>
            <div className="h-8 w-px bg-gray-300" />
            <h1 className="text-3xl font-bold text-[#16305B]">My Profile</h1>
          </div>
          <button 
            className="text-gray-500 text-sm flex items-center gap-2 hover:text-[#16305B] transition-colors group" 
            onClick={() => window.open('/help', '_blank')}
          >
            <HelpCircle size={18} className="group-hover:scale-110 transition-transform" />
            <span>Need Help?</span>
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 animate-fade-in">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium">{successMessage}</span>
          </div>
        )}

        {/* Main content grid */}
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-7xl mx-auto">
          {/* My Info */}
          <div className="flex flex-col gap-8 md:w-[55%] w-full">
            <div className="bg-white rounded-lg shadow-md p-10 w-full" style={{ maxWidth: 480, marginLeft: 8 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-xl text-gray-900">Personal Information</h2>
                {attorney?.verified && (
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-semibold text-green-700">Verified</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-gray-700">First Name</label>
                  <input
                    type="text"
                    value={attorney?.firstName || ""}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-gray-700">Last Name</label>
                  <input
                    type="text"
                    value={attorney?.lastName || ""}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-gray-700">Email Address</label>
                  <input
                    type="email"
                    value={attorney?.email || ""}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-gray-700">Law Firm</label>
                  <input
                    type="text"
                    value={attorney?.lawFirmName || ""}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-gray-700">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={"************"}
                      disabled
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-[15px] pr-10 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-gray-700">Phone Number</label>
                  <input
                    type="text"
                    value={attorney?.phoneNumber || "Not provided"}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                  />
                </div>
                <button
                  type="button"
                  className="mt-4 px-6 py-3 bg-[#16305B] text-white rounded-lg hover:bg-[#1e417a] text-[15px] font-semibold shadow-sm transition-all hover:shadow-md"
                  style={{ width: 'fit-content' }}
                  onClick={() => {
                    setEditData({
                      firstName: attorney?.firstName || "",
                      lastName: attorney?.lastName || "",
                      email: attorney?.email || "",
                      phoneNumber: attorney?.phoneNumber || ""
                    });
                    setShowEdit(true);
                    setErrorMessage(null);
                  }}
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>

          {/* Manage Account */}
          <div className="flex flex-col gap-6 md:w-[45%] w-full">
            <div className="bg-white rounded-lg shadow-md p-8 w-full" style={{ maxWidth: 420 }}>
              <h2 className="font-bold text-xl mb-6 text-gray-900">Account Settings</h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Account Status:</strong> {attorney?.verified ? 'Verified' : 'Pending Verification'}
                  </p>
                </div>
                <button
                  className="w-full border-2 border-red-300 text-red-600 rounded-lg py-3 hover:bg-red-50 transition-colors text-[15px] font-semibold flex items-center justify-center gap-2 group"
                  onClick={() => setShowDelete(true)}
                >
                  <AlertCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Delete Account
                </button>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-lg shadow-md p-8 w-full" style={{ maxWidth: 420 }}>
              <h2 className="font-bold text-xl mb-6 text-gray-900">Payment Methods</h2>
              <div className="space-y-4">
                {paymentMethod ? (
                  <>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm text-green-800 font-medium">{paymentMethod}</span>
                      </div>
                      <button
                        onClick={handleRemovePaymentMethod}
                        className="text-red-600 hover:text-red-700 text-sm font-semibold underline"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">This payment method will be used for receiving payouts.</p>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600">
                        No payment method added. Add one to receive payouts for your cases.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowAddPayment(true);
                        setErrorMessage(null);
                      }}
                      className="w-full border-2 border-[#16305B] text-[#16305B] rounded-lg py-3 hover:bg-blue-50 transition-colors text-[15px] font-semibold"
                    >
                      Add Payment Method
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Spacer for 20% width on the right */}
          <div className="hidden md:block md:w-[20%]" />
        </div>

        {/* Edit Profile Modal */}
        {showEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto bg-black/20 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border-4 border-[#16305B] animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#16305B]">Edit Profile</h2>
                <button
                  onClick={() => {
                    if (!updating) {
                      setShowEdit(false);
                      setErrorMessage(null);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:cursor-not-allowed"
                  disabled={updating}
                >
                  <X size={24} />
                </button>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-800">{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800">{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleEditProfile} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-800 font-semibold mb-2">First Name *</label>
                  <input
                    name="firstName"
                    type="text"
                    value={editData.firstName}
                    onChange={handleEditChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                    disabled={updating}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-800 font-semibold mb-2">Last Name *</label>
                  <input
                    name="lastName"
                    type="text"
                    value={editData.lastName}
                    onChange={handleEditChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                    disabled={updating}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-800 font-semibold mb-2">Email Address</label>
                  <input
                    name="email"
                    type="email"
                    value={editData.email}
                    disabled
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-800 font-semibold mb-2">Phone Number</label>
                  <input
                    name="phoneNumber"
                    type="tel"
                    value={editData.phoneNumber}
                    onChange={handleEditChange}
                    placeholder="(123) 456-7890"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                    disabled={updating}
                  />
                </div>
                <div className="flex gap-3 mt-6 pt-4 border-t">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-[#16305B] text-white rounded-lg hover:bg-[#1e417a] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
                    disabled={updating}
                  >
                    {updating ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                        Updating...
                      </span>
                    ) : "Update Profile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEdit(false);
                      setErrorMessage(null);
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                    disabled={updating}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Account Modal */}
        {showDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto bg-black/20 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Delete Account</h2>
                <button
                  className="text-gray-500 hover:text-gray-700 transition-colors disabled:cursor-not-allowed"
                  onClick={() => {
                    if (!deleting) {
                      setShowDelete(false);
                      setErrorMessage(null);
                    }
                  }}
                  disabled={deleting}
                  aria-label="Close"
                >
                  <X size={24} />
                </button>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-800">{errorMessage}</span>
                </div>
              )}

              <div className="mb-6 space-y-3">
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">This action cannot be undone.</p>
                    <p>All your data, cases, and documents will be permanently deleted.</p>
                  </div>
                </div>
                <p className="text-[15px] text-gray-700">Are you absolutely sure you want to delete your account?</p>
              </div>

              <div className="flex gap-3">
                <button
                  className="flex-1 px-6 py-3 bg-[#B3261E] text-white rounded-lg font-semibold hover:bg-[#a11d17] focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm hover:shadow-md"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                      Deleting...
                    </span>
                  ) : "Yes, Delete Account"}
                </button>
                <button
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
                  onClick={() => {
                    setShowDelete(false);
                    setErrorMessage(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Payment Method Modal */}
        {showAddPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto bg-black/20 backdrop-blur-sm">
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg animate-scale-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-[#16305B]">Add Payment Method</h2>
                <button
                  onClick={() => {
                    setShowAddPayment(false);
                    setErrorMessage(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-800">{errorMessage}</span>
                </div>
              )}

              {/* Payment Type Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Select Payment Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "venmo", label: "Venmo" },
                    { value: "paypal", label: "PayPal" },
                    { value: "zelle", label: "Zelle" },
                    { value: "card", label: "Credit Card" }
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setPaymentMethodType(type.value as any)}
                      className={`p-3 rounded-lg border-2 font-semibold text-sm transition-all ${
                        paymentMethodType === type.value
                          ? "border-[#16305B] bg-blue-50 text-[#16305B]"
                          : "border-gray-300 hover:border-gray-400 text-gray-700"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Details Form */}
              <div className="space-y-4">
                {paymentMethodType === "venmo" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Venmo Handle *</label>
                    <input
                      type="text"
                      placeholder="@username"
                      value={paymentDetails.venmoHandle}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, venmoHandle: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                    />
                  </div>
                )}

                {paymentMethodType === "paypal" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">PayPal Email *</label>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={paymentDetails.paypalEmail}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, paypalEmail: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                    />
                  </div>
                )}

                {paymentMethodType === "zelle" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Zelle Email *</label>
                    <input
                      type="email"
                      placeholder="your.email@example.com"
                      value={paymentDetails.zelleEmail}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, zelleEmail: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                    />
                  </div>
                )}

                {paymentMethodType === "card" && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Cardholder Name *</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={paymentDetails.cardholderName}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, cardholderName: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Card Number *</label>
                      <input
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        value={paymentDetails.cardNumber}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, cardNumber: e.target.value })}
                        maxLength={19}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Expiry Date *</label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={paymentDetails.expiryDate}
                          onChange={(e) => setPaymentDetails({ ...paymentDetails, expiryDate: e.target.value })}
                          maxLength={5}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">CVV *</label>
                        <input
                          type="text"
                          placeholder="123"
                          value={paymentDetails.cvv}
                          onChange={(e) => setPaymentDetails({ ...paymentDetails, cvv: e.target.value })}
                          maxLength={3}
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#16305B] transition"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={handleAddPaymentMethod}
                  className="flex-1 px-6 py-3 bg-[#16305B] text-white rounded-lg hover:bg-[#1e417a] font-semibold transition-colors shadow-sm hover:shadow-md"
                >
                  Add Payment Method
                </button>
                <button
                  onClick={() => {
                    setShowAddPayment(false);
                    setErrorMessage(null);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </main>
  );
}