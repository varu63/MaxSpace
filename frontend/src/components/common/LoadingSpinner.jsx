const LoadingSpinner = ({ minHeight = "min-h-[50vh]" }) => (
  <div className={`flex items-center justify-center ${minHeight}`}>
    <div className="w-8 h-8 border-2 border-[#E7E1D3] border-t-[#173B5C] rounded-full animate-spin" />
  </div>
);

export default LoadingSpinner;
