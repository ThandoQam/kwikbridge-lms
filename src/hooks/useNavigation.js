// KwikBridge LMS — useNavigation Hook
// Manages page navigation with history tracking for back button.

import { useState, useCallback } from "react";

export function useNavigation(initialPage = "public_home") {
  const [page, setPageRaw] = useState(initialPage);
  const [pageHistory, setPageHistory] = useState([]);
  const [detail, setDetail] = useState(null);

  const navTo = useCallback((pg) => {
    setPageHistory(h => [...h.slice(-10), page]);
    setPageRaw(pg);
    setDetail(null);
  }, [page]);

  const goBack = useCallback(() => {
    if (detail) { setDetail(null); return; }
    if (pageHistory.length > 0) {
      const prev = pageHistory[pageHistory.length - 1];
      setPageHistory(h => h.slice(0, -1));
      setPageRaw(prev);
    }
  }, [detail, pageHistory]);

  const canGoBack = pageHistory.length > 0 || detail !== null;

  return { page, setPage: setPageRaw, navTo, goBack, canGoBack, detail, setDetail, pageHistory };
}
