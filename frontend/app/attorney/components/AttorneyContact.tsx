"use client";

import Image from "next/image";
import { ArrowLeft, Clock, Phone, Mail, MapPin, MessageCircle } from "lucide-react";

export default function AttorneyContact({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 bg-[#F7F6F3] min-h-screen font-sans">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-10 py-8">
        
        {/* Header */}
        <div className="mb-10">
          <button 
            onClick={onBack} 
            className="flex items-center gap-2 text-[#16305B] hover:text-[#1e417a] transition-colors group mb-6"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold">Back to Help</span>
          </button>
          <div>
            <h1 className="text-4xl font-bold text-[#16305B] mb-2">Get in Touch</h1>
            <p className="text-gray-600">We're here to help and answer any questions you might have</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          
          {/* Left: Contact Info Cards */}
          <div className="space-y-6">
            
            {/* Business Hours Card */}
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <Clock className="text-[#16305B]" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#16305B] mb-4">Business Hours</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Monday - Friday</span>
                      <span className="text-gray-600">8:00 AM - 5:00 PM</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                      <span className="font-medium text-gray-700">Saturday</span>
                      <span className="text-gray-600">8:00 AM - 2:00 PM</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">Sunday</span>
                      <span className="text-red-600 font-semibold">Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone Card */}
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <Phone className="text-green-600" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#16305B] mb-2">Phone Support</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Speak directly with our support team
                  </p>
                  <a
                    href="tel:+11234567890"
                    className="text-2xl font-semibold text-[#16305B] hover:text-[#1e417a] transition-colors"
                  >
                    (123) 456-7890
                  </a>
                </div>
              </div>
            </div>

            {/* Email Card */}
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <div className="bg-purple-50 p-3 rounded-lg">
                  <Mail className="text-purple-600" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#16305B] mb-2">Email Support</h3>
                  <p className="text-gray-600 text-sm mb-3">
                    Get a response within 24 hours
                  </p>
                  <a
                    href="mailto:support@quickverdict.com"
                    className="text-lg font-semibold text-[#16305B] hover:text-[#1e417a] transition-colors underline"
                  >
                    support@quickverdict.com
                  </a>
                </div>
              </div>
            </div>

            {/* Office Location Card */}
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <div className="bg-orange-50 p-3 rounded-lg">
                  <MapPin className="text-orange-600" size={28} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#16305B] mb-2">Office Location</h3>
                  <p className="text-gray-600">
                    123 Legal District<br />
                    Suite 456<br />
                    City, State 12345<br />
                    United States
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Right: Image & CTA */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
              <div className="relative w-full h-[400px]">
                <Image
                  src="/contact_image.png"
                  alt="Contact Support"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div className="p-6 bg-gradient-to-br from-blue-50 to-white">
                <h3 className="text-xl font-bold text-[#16305B] mb-2">Need Immediate Assistance?</h3>
                <p className="text-gray-600 mb-4">
                  Our dedicated support team is ready to help you with any questions or concerns.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a
                    href="tel:+11234567890"
                    className="flex-1 bg-[#16305B] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1e417a] transition-all shadow-sm hover:shadow-md text-center flex items-center justify-center gap-2"
                  >
                    <Phone size={18} />
                    Call Now
                  </a>
                  <a
                    href="mailto:support@quickverdict.com"
                    className="flex-1 bg-white text-[#16305B] border-2 border-[#16305B] px-6 py-3 rounded-lg font-semibold hover:bg-[#16305B] hover:text-white transition-all text-center flex items-center justify-center gap-2"
                  >
                    <Mail size={18} />
                    Email Us
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Response Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <div className="flex items-start gap-3">
                <MessageCircle className="text-[#16305B] flex-shrink-0 mt-1" size={24} />
                <div>
                  <h4 className="font-bold text-[#16305B] mb-2">Quick Response Guarantee</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    We strive to respond to all inquiries within 24 hours during business hours. 
                    For urgent matters, please call our phone support line directly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="mt-12 bg-[#16305B] rounded-xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-2">Have a Complex Question?</h3>
          <p className="text-blue-100 mb-6">
            Schedule a consultation with our team to discuss your specific needs
          </p>
          <button className="bg-white text-[#16305B] px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-md hover:shadow-lg">
            Schedule Consultation
          </button>
        </div>
      </div>
    </div>
  );
}