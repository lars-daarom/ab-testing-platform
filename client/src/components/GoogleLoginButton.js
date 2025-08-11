import React from 'react';

const GoogleLoginButton = ({ text = 'Sign in with Google', onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Sign in with Google"
    className={`flex items-center justify-center w-full bg-white border border-[#dadce0] text-[#3c4043] rounded shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#4285F4] focus:ring-offset-2 font-medium ${className}`}
  >
    <svg className="w-5 h-5 mr-2" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M9 3.48c1.69 0 2.81.73 3.46 1.34L14.89 2.4C13.32.99 11.43 0 9 0 5.48 0 2.44 2.08 1.05 5.11l3.34 2.6C4.96 5.29 6.81 3.48 9 3.48z"/>
      <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.29-.19-1.85H9v3.48h4.96c-.1.83-.64 2.07-1.84 2.9l2.84 2.21C16.15 14.54 17.64 12.03 17.64 9.2z"/>
      <path fill="#FBBC05" d="M3.39 10.71C3.17 10.07 3.04 9.41 3.04 8.73c0-.68.13-1.34.35-1.98L.05 4.15A8.97 8.97 0 000 8.73c0 1.41.33 2.74.9 3.9l3.43-1.92z"/>
      <path fill="#34A853" d="M9 17.46c2.43 0 4.46-.8 5.95-2.17l-2.84-2.21c-.76.51-1.72.86-3.11.86-2.38 0-4.39-1.6-5.11-3.84l-3.34 2.6C2.44 15.92 5.48 17.46 9 17.46z"/>
    </svg>
    <span>{text}</span>
  </button>
);

export default GoogleLoginButton;
