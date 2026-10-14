import { useEffect, useState } from "react";

export function useCountdown(endsAt: string | null, serverOffsetMs: number) {
  const compute = () =>
    endsAt ? Math.max(0, Math.round((Date.parse(endsAt) - (Date.now() + serverOffsetMs)) / 1000)) : 0;
  const [seconds, setSeconds] = useState(compute);

  useEffect(() => {
    setSeconds(compute());
    if (!endsAt) return;
    const timer = setInterval(() => setSeconds(compute()), 1000);
    return () => clearInterval(timer);
  });

  return seconds;
}
