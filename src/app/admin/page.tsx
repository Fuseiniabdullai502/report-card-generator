'use client';

// This page is no longer in use after reverting the user invite system.
// It is kept as an empty placeholder.
export default function AdminPage() {
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
  return null;
}
