import { useEffect, useRef } from 'react';

interface AdaptivePollingOptions {
  delay?: number; // active polling delay in ms (default 30000)
  disableOnHidden?: boolean; // whether to pause polling when tab is hidden (default true)
}

export function useAdaptivePolling(
  callback: () => void | Promise<void>,
  options: AdaptivePollingOptions = {},
  dependencies: any[] = []
) {
  const { delay = 30000, disableOnHidden = true } = options;
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isTabActive = true;

    const tick = () => {
      if (disableOnHidden && !isTabActive) return;
      callbackRef.current();
    };

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      if (delay > 0) {
        intervalId = setInterval(tick, delay);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        isTabActive = true;
        // Refetch immediately when tab becomes visible
        tick();
        startPolling();
      } else {
        isTabActive = false;
        if (disableOnHidden) {
          stopPolling();
        }
      }
    };

    const handleWindowFocus = () => {
      // Refresh on window focus as a user action sign
      tick();
    };

    const handleErpActivity = () => {
      // Refresh immediately after a logged business action
      tick();
    };

    // Initial fetch and start polling
    tick();
    startPolling();

    // Listeners for page visibility and window focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('erp_activity_performed', handleErpActivity);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('erp_activity_performed', handleErpActivity);
    };
  }, [delay, disableOnHidden, ...dependencies]);
}
