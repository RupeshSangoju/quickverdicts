"use client";

import { ReactNode } from "react";

type FormContainerProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export default function FormContainer({ children, title, subtitle }: FormContainerProps) {
  return (
    <div className="flex-1 flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        {title && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#16305B] mb-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-600">{subtitle}</p>
            )}
          </div>
        )}

        {/* Form Container with Border */}
        <div className="bg-white rounded-xl shadow-md border-2 border-[#16305B]/20 p-8 md:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
