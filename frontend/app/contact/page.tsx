import Image from "next/image";
import Link from "next/link";

export default function Contact() {
  return (
    <div className="bg-[#f9f7f2] min-h-screen px-8 py-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <Link href="/" className="text-[#0A2342] text-base flex items-center hover:underline mb-2">
            <span className="mr-2 text-xl">&#8592;</span> Back
          </Link>
          <h1 className="text-3xl font-bold text-[#222] mt-10 pl-8">Contact Us</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          {/* Left: Contact Info */}
          <div className="flex flex-col items-start pl-2 md:pl-8 text-[19px] leading-relaxed w-full" style={{minHeight: '420px'}}>
          <div className="mb-10">
            <div className="font-semibold mb-4 text-[20px] text-[#0A2342]">Business Hours</div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-3">
              <div className="text-[#0A2342]">Monday ~ Friday</div>
              <div className="text-[#455A7C]">8:00 AM ~ 5:00 PM</div>
              <div className="text-[#0A2342]">Saturday</div>
              <div className="text-[#455A7C]">8:00 AM ~ 2:00 PM</div>
              <div className="text-[#0A2342]">Sunday</div>
              <div className="text-[#455A7C]">Closed</div>
            </div>
          </div>
          <div className="mb-10">
            <div className="font-semibold mb-4 text-[20px] text-[#0A2342]">Phone</div>
            <div className="text-[#455A7C]">(123) 456-7890</div>
          </div>
          <div className="mb-2">
            <div className="font-semibold mb-4 text-[20px] text-[#0A2342]">Email</div>
            <a
              href="mailto:support@quickverdict.com"
              className="text-[#0A2342] underline hover:text-[#1a3666]"
            >
              support@quickverdict.com
            </a>
          </div>
        </div>
        {/* Right: Image */}
        <div className="flex justify-center md:justify-end">
          <Image
            src="/contact_image.png"
            alt="Contact Support"
            width={600}
            height={400}
            className="rounded-md object-cover shadow-md"
            style={{ maxWidth: '600px', maxHeight: '400px', width: '100%', height: 'auto' }}
          />
        </div>
      </div>
    </div>
    </div>
  );
}
