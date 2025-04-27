// File Path: src/app/results/page.js
// MINIMAL TEST CASE
'use client'
import Link from 'next/link';

export default function ResultsPage() {
  // You can add console.log here to see if the component function even runs
  console.log('[ResultsPage MINIMAL TEST] Rendering simple test page.');
  return (
    <div style={{ padding: '50px', border: '5px solid red' }}>
      <h1>MINIMAL RESULTS PAGE RENDERED</h1>
      <p>If you see this, the correct file is being served.</p>
      <Link href="/">Go Home</Link>
    </div>
  );
}
