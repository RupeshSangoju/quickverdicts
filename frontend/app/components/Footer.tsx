import Link from "next/link";
import { FaTwitter, FaInstagram, FaFacebook, FaLinkedin } from "react-icons/fa";
import { FC } from "react";

const Footer: FC = () => {
  return (
    <footer className="bg-[#0A2342] text-white py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        {/* Left side */}
        <div className="flex flex-col justify-between">
          {/* Contact Info */}
          <div>
            <p className="font-semibold">Contact Quick Verdicts</p>
            <p className="mt-2 text-sm">832-745-8743</p>
            <p className="text-sm">help@QV.com</p>
          </div>

          {/* Bottom Links */}
          <div className="flex flex-wrap gap-6 mt-8 text-sm">
            <span>Quick Verdicts © {new Date().getFullYear()}</span>
            <Link href="#" className="hover:underline">
              Privacy
            </Link>
            <Link href="#" className="hover:underline">
              Terms of Use
            </Link>
            <Link href="#" className="hover:underline">
              Consumer Notice
            </Link>
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col justify-end">
          {/* Push to bottom */}
          <p className="font-semibold mb-2 text-left">Follow Us</p>
          {/* Aligned left */}
          <div className="flex gap-4">
            <Link href="#">
              <span className="sr-only">Twitter</span>
              <FaTwitter className="w-6 h-6" />
            </Link>
            <Link href="#">
              <span className="sr-only">Instagram</span>
              <FaInstagram className="w-6 h-6" />
            </Link>
            <Link href="#">
              <span className="sr-only">Facebook</span>
              <FaFacebook className="w-6 h-6" />
            </Link>
            <Link href="#">
              <span className="sr-only">LinkedIn</span>
              <FaLinkedin className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
