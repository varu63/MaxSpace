export const getStatusStyle = (status) => {
  const value = status?.toLowerCase();

  if (value === "completed" || value === "complete") {
    return "bg-green-100 text-green-700";
  }

  if (value === "in progress" || value === "active") {
    return "bg-blue-100 text-blue-700";
  }

  if (value === "booked") {
    return "bg-purple-100 text-purple-700";
  }

  if (value === "pending" || value === "fg pending") {
    return "bg-[#FBF1C9] text-[#A77A08]";
  }

  return "bg-[#F5F1E7] text-[#747B83]";
};
