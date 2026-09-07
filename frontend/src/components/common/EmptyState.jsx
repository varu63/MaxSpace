import React from "react";

const EmptyState = ({ icon: Icon, title, description, className = "" }) => (
  <div className={`p-12 text-center ${className}`}>
    {Icon && <Icon className="w-10 h-10 mx-auto text-[#B48611]" />}
    <h3 className="mt-4 text-lg font-bold">{title}</h3>
    {description && (
      <p className="mt-1 text-sm text-[#747B83]">{description}</p>
    )}
  </div>
);

export default React.memo(EmptyState);
