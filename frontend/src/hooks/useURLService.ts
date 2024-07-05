import { useSearchParams, useNavigate } from "react-router-dom";

export function useURLService(): {
  selectedService: string | null;
  setSelectedService: (service: string | null) => void;
} {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedService = searchParams.get("service");

  const setSelectedService = (service: string | null) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (service) {
      newSearchParams.set("service", service);
    } else {
      newSearchParams.delete("service");
    }
    // Use navigate to update the URL and add an entry to the history stack
    navigate({ search: newSearchParams.toString() });
  };

  return { selectedService, setSelectedService };
}
