'use client';
import { useState } from 'react';

export function useAsyncForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setMessage(null);
    setError('');
  }

  return { message, setMessage, error, setError, pending, setPending, loading, setLoading, reset };
}
