"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, HelpCircle, X } from "lucide-react";
import { SiVenmo, SiCashapp } from "react-icons/si";
import { FaPaypal } from "react-icons/fa";
import { getToken } from "@/lib/apiClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
  : "http://localhost:4000";


type Juror = {
  id: string;
  name: string;
  email: string;
  county?: string;
  state?: string;
  verified?: boolean;
  verificationStatus?: string;
  onboardingCompleted?: boolean;
  phone?: string;
};

export default function ProfileSection() {
  const [juror, setJuror] = useState<Juror | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editData, setEditData] = useState({ name: "", email: "", password: "", phone: "" });
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchJuror = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getToken();

        if (!token) {
          setError("Authentication token not found. Please login again.");
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/api/juror/profile`, {
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
            setError(`Failed to fetch juror details: ${res.status}`);
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (data.success && data.data?.juror) {
          const jurorData = data.data.juror;
          setJuror({
            id: jurorData.id || jurorData.JurorId,
            name: jurorData.name || "",
            email: jurorData.email || jurorData.Email || "",
            county: jurorData.county || jurorData.County || "",
            state: jurorData.state || jurorData.State || "",
            phone: jurorData.phoneNumber || jurorData.PhoneNumber || "",
            verified: jurorData.isVerified || jurorData.IsVerified || false,
            verificationStatus: jurorData.verificationStatus || jurorData.VerificationStatus || "pending",
            onboardingCompleted: jurorData.onboardingCompleted || jurorData.OnboardingCompleted || false
          });
        } else {
          setError("Failed to fetch juror details");
        }
      } catch (err) {
        setJuror(null);
        setError("Failed to fetch juror details");
      } finally {
        setLoading(false);
      }
    };
    fetchJuror();
  }, []);

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  }

  async function sendOtp() {
    try {
      const token = getToken();
      if (!token) {
        alert("Authentication token not found. Please login again.");
        return false;
      }

      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ email: juror?.email }),
      });

      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        return true;
      } else {
        alert(data.message || "Failed to send OTP");
        return false;
      }
    } catch (err) {
      alert("Failed to send OTP. Please try again.");
      return false;
    }
  }

  async function verifyOtpAndUpdate() {
    setVerifyingOtp(true);
    try {
      const token = getToken();
      if (!token) {
        alert("Authentication token not found. Please login again.");
        setVerifyingOtp(false);
        return;
      }

      // First verify OTP
      const verifyRes = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: juror?.email,
          otp: otp
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        alert(verifyData.message || "Invalid OTP. Please try again.");
        setVerifyingOtp(false);
        return;
      }

      // OTP verified, now update profile with password
      const updateRes = await fetch(`${API_BASE}/api/juror/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editData.name,
          email: editData.email,
          password: editData.password,
          phone: editData.phone,
        }),
      });

      const updateData = await updateRes.json();
      if (updateData.success) {
        alert("Profile updated successfully!");
        if (updateData.juror) {
          setJuror(updateData.juror);
        } else {
          setJuror(j => j ? { ...j, name: editData.name, phone: editData.phone } : j);
        }
        setShowOtpModal(false);
        setShowEdit(false);
        setOtp("");
        setOtpSent(false);
        setEditData({ name: "", email: "", password: "", phone: "" });
      } else {
        alert(updateData.message || "Failed to update profile");
      }
    } catch (err) {
      alert("Failed to update profile. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
          <div className="animate-spin rounded-full h-20 w-20 border-t-8 border-b-8 border-[#0C2D57] mb-6" />
          <span className="text-lg text-[#0C2D57] font-semibold">Loading profile...</span>
        </div>
      </main>
    );
  }

  // If juror is null after loading, show empty fields

  async function handleEditProfile(e: React.FormEvent) {
    e.preventDefault();

    // If password is being changed, require OTP verification
    if (editData.password && editData.password.trim() !== "") {
      setUpdating(true);
      const otpSentSuccess = await sendOtp();
      setUpdating(false);

      if (otpSentSuccess) {
        setShowOtpModal(true);
      }
      return;
    }

    // If no password change, update profile normally
    setUpdating(true);
    try {
      const token = getToken();

      if (!token) {
        setError("Authentication token not found. Please login again.");
        setUpdating(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/juror/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          name: editData.name,
          email: editData.email,
          phone: editData.phone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.juror) {
          setJuror(data.juror);
        } else {
          setJuror(j => j ? { ...j, name: editData.name, phone: editData.phone } : j);
        }
        alert("Profile updated successfully!");
        setShowEdit(false);
      } else {
        alert(data.message || "Failed to update profile");
      }
    } catch (err) {
      alert("Failed to update profile");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      // Get token from cookies
      let token = null;
      if (typeof document !== "undefined") {
        const match = document.cookie.match(/(?:^|; )token=([^;]*)/);
        token = match ? decodeURIComponent(match[1]) : null;
      }
      
      // Simulate API call for demo
      setTimeout(() => {
        alert("Account deleted successfully");
        // In real app: window.location.href = "/juror/login";
        setShowDelete(false);
        setDeleting(false);
      }, 1500);

      const res = await fetch(`${API_BASE}/api/juror/profile`, {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        },
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/login/juror";
      } else {
        alert(data.message || "Failed to delete account");
      }
    } catch (err) {
      alert("Failed to delete account");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
          <div className="animate-spin rounded-full h-20 w-20 border-t-8 border-b-8 border-[#0C2D57] mb-6" />
          <span className="text-lg text-[#0C2D57] font-semibold">Loading profile...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 min-h-screen flex items-center justify-center bg-[#FAF9F6]">
        <div className="text-center">
          <div className="text-red-600 text-xl font-semibold mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-[#0C2D57] text-white rounded hover:bg-[#0a2342]"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen overflow-y-auto p-0">
      <div className="p-8 md:p-10 bg-[#FAF9F6] min-h-screen w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[#0C2D57]">Profile</h1>
          <button className="text-gray-500 text-sm flex items-center gap-1 hover:underline" style={{ marginRight: 8 }}>
            <HelpCircle size={16} className="inline-block align-middle" />
            <span className="inline-block align-middle">Help</span>
          </button>
        </div>

        {/* Main content grid */}
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-7xl mx-auto">
          {/* My Info */}
          <div className="flex flex-col gap-8 md:w-[55%] w-full">
            {/* My Info section */}
            <div className="bg-white rounded shadow p-10 w-full" style={{ minHeight: 340, maxWidth: 480, marginLeft: 8, color: "black" }}>
              <h2 className="font-semibold text-lg mb-6" style={{ color: "black" }}>My Info</h2>
              <div className="flex flex-col gap-5">
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-[#0A2342]">Full Name</label>
                  <input
                    type="text"
                    value={juror?.name || ""}
                    disabled
                    className="w-full border border-gray-300 rounded-md px-4 py-2.5 bg-white text-[15px] font-medium text-[#0A2342] focus:outline-none focus:ring-2 focus:ring-[#0C2D57] transition cursor-not-allowed"
                    style={{ color: "#0A2342" }}
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-[#0A2342]">Email Address</label>
                  <input
                    type="email"
                    value={juror?.email || ""}
                    disabled
                    className="w-full border border-gray-300 rounded-md px-4 py-2.5 bg-white text-[15px] font-medium text-[#0A2342] focus:outline-none focus:ring-2 focus:ring-[#0C2D57] transition cursor-not-allowed"
                    style={{ color: "#0A2342" }}
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-[#0A2342]">Phone Number</label>
                  <input
                    type="text"
                    value={juror?.phone || "Not provided"}
                    disabled
                    className="w-full border border-gray-300 rounded-md px-4 py-2.5 bg-white text-[15px] font-medium text-[#0A2342] focus:outline-none focus:ring-2 focus:ring-[#0C2D57] transition cursor-not-allowed"
                    style={{ color: "#0A2342" }}
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-[#0A2342]">State</label>
                  <input
                    type="text"
                    value={juror?.state || "Not provided"}
                    disabled
                    className="w-full border border-gray-300 rounded-md px-4 py-2.5 bg-white text-[15px] font-medium text-[#0A2342] focus:outline-none focus:ring-2 focus:ring-[#0C2D57] transition cursor-not-allowed"
                    style={{ color: "#0A2342" }}
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-[#0A2342]">County</label>
                  <input
                    type="text"
                    value={juror?.county || "Not provided"}
                    disabled
                    className="w-full border border-gray-300 rounded-md px-4 py-2.5 bg-white text-[15px] font-medium text-[#0A2342] focus:outline-none focus:ring-2 focus:ring-[#0C2D57] transition cursor-not-allowed"
                    style={{ color: "#0A2342" }}
                  />
                </div>
                <div>
                  <label className="block text-[15px] font-semibold mb-2 text-[#0A2342]">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value="************"
                      disabled
                      className="w-full border border-gray-300 rounded-md px-4 py-2.5 bg-white text-[15px] font-medium text-[#0A2342] focus:outline-none focus:ring-2 focus:ring-[#0C2D57] transition cursor-not-allowed pr-10"
                      style={{ color: "#0A2342" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-2 px-5 py-2 bg-[#0C2D57] text-white rounded-md hover:bg-[#0a2342] text-[15px] font-medium shadow-sm transition"
                  style={{ width: 130 }}
                  onClick={() => {
                    setEditData({
                      name: juror?.name || "",
                      email: juror?.email || "",
                      password: "",
                      phone: juror?.phone || ""
                    });
                    setShowEdit(true);
                  }}
                >
                  Edit Profile
                </button>
              </div>
            </div>

            {/* Connected Accounts */}
            {/* Connected Accounts section */}
            <div className="bg-white rounded shadow p-7 w-full mt-6" style={{ maxWidth: 480, marginLeft: 8, color: "black" }}>
              <h2 className="font-semibold text-lg mb-5" style={{ color: "black" }}>Connected Accounts</h2>
              <div className="flex flex-col gap-3">
                {/* Venmo */}
                <div className="flex items-center border border-gray-300 rounded-md bg-[#F3F6FA] px-4 py-2" style={{ minHeight: 44, color: "black" }}>
                  <SiVenmo className="text-[#3D95CE] text-2xl mr-3" />
                  <span className="font-semibold text-[15px]">Venmo</span>
                  <span className="ml-auto text-green-700 font-bold text-base">✓</span>
                </div>

                {/* PayPal */}
                <div className="flex items-center border border-gray-300 rounded-md bg-white px-4 py-2 hover:bg-[#F3F6FA] cursor-pointer" style={{ minHeight: 44, color: "black" }}>
                  <FaPaypal className="text-[#003087] text-2xl mr-3" />
                  <span className="font-semibold text-[15px]">Paypal</span>
                </div>

                {/* CashApp */}
                <div className="flex items-center border border-gray-300 rounded-md bg-white px-4 py-2 hover:bg-[#F3F6FA] cursor-pointer" style={{ minHeight: 44, color: "black" }}>
                  <SiCashapp className="text-[#00C244] text-2xl mr-3" />
                  <span className="font-semibold text-[15px]">Cashapp</span>
                </div>
              </div>
            </div>
          </div>

          {/* Manage Account */}
          {/* Manage Account section */}
          <div className="flex flex-col gap-6 md:w-[45%] w-full">
            <div className="bg-white rounded shadow p-8 w-full" style={{ minHeight: 120, maxWidth: 420, color: "black" }}>
              <h2 className="font-semibold text-lg mb-4" style={{ color: "black" }}>Manage Account</h2>
              <button
                className="w-full border border-gray-400 rounded py-2 hover:bg-gray-100 transition-colors text-[15px] font-medium text-black"
                onClick={() => setShowDelete(true)}
              >
                Delete Account
              </button>
            </div>
          </div>

          {/* Spacer for 20% width on the right */}
          <div className="hidden md:block md:w-[20%]" />
        </div>

        {/* Edit Profile Modal */}
        {showEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
            {/* Lighter subtle grey overlay to highlight modal */}
            <div
            className="absolute inset-0 bg-black/10"
            onClick={() => !updating && setShowEdit(false)}
            ></div>
            {/* Modal content */}
            <div className="relative bg-white rounded-lg shadow-2xl p-8 w-full max-w-md border-4" style={{ borderColor: '#0C2D57' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: '#0C2D57' }}>Edit Profile</h2>
                <button
                  onClick={() => !updating && setShowEdit(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={updating}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-800 font-medium mb-1">Full Name</label>
                  <input 
                    name="name" 
                    type="text" 
                    value={editData.name} 
                    onChange={handleEditChange} 
                    className="w-full border rounded px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-800 font-medium mb-1">Email Address</label>
                  <input
                    name="email"
                    type="email"
                    value={editData.email}
                    disabled
                    className="w-full border rounded px-3 py-2 bg-gray-100 text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-800 font-medium mb-1">Phone Number</label>
                  <input
                    name="phone"
                    type="text"
                    value={editData.phone}
                    onChange={handleEditChange}
                    className="w-full border rounded px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-800 font-medium mb-1">New Password (Optional)</label>
                  <input
                    name="password"
                    type="password"
                    value={editData.password}
                    onChange={handleEditChange}
                    placeholder="Enter new password to change"
                    className="w-full border rounded px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {editData.password && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Changing password requires email verification</p>
                  )}
                </div>
                <div className="flex gap-2 mt-6">
                  <button 
                    onClick={handleEditProfile}
                    className="px-4 py-2 bg-[#0C2D57] text-white rounded hover:bg-[#0a2342] min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
                    disabled={updating}
                  >
                    {updating ? "Updating..." : "Update"}
                  </button>
                  <button 
                    onClick={() => setShowEdit(false)} 
                    className="px-4 py-2 text-gray-800 bg-gray-200 rounded hover:bg-gray-300 transition-colors" 
                    disabled={updating}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Account Modal */}
        {showDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
            {/* Subtle overlay */}
            <div
              className="absolute inset-0 bg-black/10"
              onClick={() => !deleting && setShowDelete(false)}
            ></div>
            {/* Modal content styled to match provided image */}
            <div className="relative bg-white rounded-xl shadow-xl p-7 w-full max-w-lg" style={{ minWidth: 380, maxWidth: 440 }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-[#222]">Delete Account</h2>
                <button
                  className="text-gray-500 text-xl hover:text-gray-700"
                  onClick={() => !deleting && setShowDelete(false)}
                  disabled={deleting}
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="mb-6 mt-1 text-[15px] text-gray-800">Are you sure you want to delete your account?</div>
              <div className="flex gap-2 justify-end">
                <button
                  className="px-6 py-2 bg-[#B3261E] text-white rounded shadow-sm font-medium text-[16px] hover:bg-[#a11d17] focus:outline-none focus:ring-2 focus:ring-red-400 border border-[#B3261E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  className="px-6 py-2 bg-white text-[#222] rounded shadow-sm font-medium text-[16px] border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
                  onClick={() => setShowDelete(false)}
                  disabled={deleting}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OTP Verification Modal */}
        {showOtpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => !verifyingOtp && setShowOtpModal(false)}
            ></div>
            <div className="relative bg-white rounded-lg shadow-2xl p-8 w-full max-w-md border-4" style={{ borderColor: '#0C2D57' }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: '#0C2D57' }}>Email Verification</h2>
                <button
                  onClick={() => {
                    if (!verifyingOtp) {
                      setShowOtpModal(false);
                      setOtp("");
                      setOtpSent(false);
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={verifyingOtp}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-700 mb-4">
                  We've sent a verification code to <strong>{juror?.email}</strong>
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Please enter the 6-digit code to verify your password change.
                </p>

                <label className="block text-sm text-gray-800 font-medium mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full border rounded px-3 py-2 text-black text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={verifyingOtp}
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={verifyOtpAndUpdate}
                  disabled={verifyingOtp || otp.length !== 6}
                  className="w-full px-4 py-2 bg-[#0C2D57] text-white rounded hover:bg-[#0a2342] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {verifyingOtp ? "Verifying..." : "Verify and Update"}
                </button>

                <button
                  onClick={async () => {
                    const success = await sendOtp();
                    if (success) {
                      alert("New OTP sent to your email!");
                    }
                  }}
                  disabled={verifyingOtp}
                  className="w-full px-4 py-2 text-[#0C2D57] bg-white border border-[#0C2D57] rounded hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                >
                  Resend Code
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}