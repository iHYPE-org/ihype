'use client';

export default function InviteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
      <p className="text-sm text-gray-500">This invite link could not be loaded.</p>
      <button onClick={reset} className="text-sm underline">
        Try again
      </button>
    </div>
  );
}
