import { useSearchParams, useNavigate } from "react-router-dom";

export function useURLTags(): {
  selectedURLTags: string[];
  setSelectedURLTags: (tags: string[] | null) => void;
} {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedURLTags = searchParams.get("tags")?.split(",") || [];

  const setSelectedURLTags = (tags: string[] | null) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (tags && tags.length > 0) {
      newSearchParams.set("tags", tags.join(","));
    } else {
      newSearchParams.delete("tags");
    }
    // Use navigate to update the URL and add an entry to the history stack
    navigate({ search: newSearchParams.toString() });
  };

  return { selectedURLTags, setSelectedURLTags };
}
