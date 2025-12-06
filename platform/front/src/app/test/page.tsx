'use client';

export default function TestPage() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Simple Test Page</h1>
      <p>If you can see this, Next.js is working!</p>
      <button onClick={() => alert('Button clicked!')}>
        Click Me
      </button>
    </div>
  );
}
