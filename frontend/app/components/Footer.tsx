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
              <p className="text-gray-300">Business Hours:</p>
              <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Mon., Wed., Fri.&nbsp;&nbsp;8:00 a.m. to 5:00 p.m. CST </p>
              <p className='text-gray-300'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Tues. & Thurs.&nbsp;&nbsp;&nbsp;&nbsp;9:00 a.m. to 8:30 p.m. CST</p>
              <p className='text-gray-300'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Sat.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;9:00 a.m. to 2:00 p.m. CST</p>
              <br></br>
              <p className="text-gray-300">Contact:</p>
              <p className="text-gray-300">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;QVTrials@quickverdicts.com</p>
            </div>

          {/* Bottom Links */}
          <div className="flex flex-wrap gap-6 mt-8 text-sm">
              <p className="text-gray-300">© Adaki, LLC d/b/a Quick Verdicts <sup className="text-[12px]">™</sup> 2026 All rights reserved.</p>
                              <a
    href="https://documents83y89129y.blob.core.windows.net/new/QV Privacy Policy new.pdf"
    target="_blank"
    rel="noopener noreferrer"
    className="hover:underline"
  >
    Privacy Policy
  </a>
                <a
    href="https://documents83y89129y.blob.core.windows.net/new/QV%20Privacy%20Policy.pdf"
    target="_blank"
    rel="noopener noreferrer"
    className="hover:underline"
  >
    Terms of Use
  </a>
          </div>
        </div>

        {/* Right side 
        <div className="flex flex-col justify-end">
          {/* Push to bottom 
          <p className="font-semibold mb-2 text-left">Follow Us</p>
          {/* Aligned left 
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
        */}
      </div>
    </footer>
  );
};

export default Footer;
