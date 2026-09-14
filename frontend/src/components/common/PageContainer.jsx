/* ============================================================
   PageContainer
   Shared content wrapper used by the User, Admin and Battery
   Technician layouts. Single source of truth for the page
   max-width, horizontal padding and bottom spacing so every
   page keeps the exact same margins as the User Dashboard.
 ============================================================ */
export const PageContainer = ({ children, fullWidth = false, className = "" }) => {
  return (
    <main
      className={`
        w-full
        flex-1
        ${fullWidth
          ? "px-4 sm:px-6 lg:px-8 py-6"
          : "max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12"}
        ${className}
      `}
    >
      {children}
    </main>
  );
};