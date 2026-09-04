import { useEffect, useState } from "react";

export function usePersistence() {
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    async function requestPersistence() {
      if (navigator.storage && navigator.storage.persist) {
        const persisted = await navigator.storage.persist();
        setIsPersisted(persisted);
      }
    }
    requestPersistence();
  }, []);

  return isPersisted;
}
