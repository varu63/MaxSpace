import React from "react";

/* ============================================================
   Card
   White rounded card with subtle shadow and border.
 ============================================================ */
export const Card = React.memo(({
  children,
  className = "",
  padded = true,
}) => {
  return (
    <div
      className={`
        bg-[#FFFDF8]
        border border-[#EEE9DA]
        rounded-3xl
        shadow-sm
        ${padded ? "p-6 lg:p-7" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
});

/* ============================================================
   IconBox
   Rounded dark-blue square container holding a white icon.
   `tone` can be "primary" (#173B5C) or "accent" (gold #B48611).
 ============================================================ */
export const IconBox = React.memo(({
  icon: Icon,
  size = "md",
  tone = "primary",
  className = "",
}) => {
  const sizes = {
    sm: "w-9 h-9 rounded-lg",
    md: "w-11 h-11 rounded-xl",
    lg: "w-12 h-12 rounded-2xl",
  };

  const tones = {
    primary: "bg-[#173B5C]",
    accent: "bg-[#B48611]",
  };

  const icons = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <div
      className={`
        ${sizes[size]}
        ${tones[tone]}
        flex items-center justify-center
        shrink-0
        ${className}
      `}
    >
      <Icon className={`${icons[size]} text-white`} />
    </div>
  );
});

/* ============================================================
   PageHeader
   Icon container + title + subtitle used at the top of pages.
 ============================================================ */
export const PageHeader = React.memo(({
  icon: Icon,
  title,
  subtitle,
  actions,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3">
        <IconBox icon={Icon} size="lg" />

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#16263A]">
            {title}
          </h1>

          <p className="text-sm text-[#747B83] mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
});

/* ============================================================
   SectionHeader
   Header row inside a card: icon container + title + subtitle.
 ============================================================ */
export const SectionHeader = React.memo(({
  icon: Icon,
  title,
  subtitle,
  tone = "primary",
  right,
  className = "",
}) => {
  return (
    <div
      className={`
        p-6 lg:p-7
        border-b border-[#EEE9DA]
        flex flex-wrap items-center gap-3
        ${className}
      `}
    >
      {Icon && <IconBox icon={Icon} size="md" tone={tone} />}

      <div className="flex-1 min-w-0">
        <h2 className="font-bold text-lg text-[#16263A]">
          {title}
        </h2>

        {subtitle && (
          <p className="text-xs text-[#747B83] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
});

/* ============================================================
   StatCard
   Unified statistic card: icon box top-right, small label,
   large value, optional description.
 ============================================================ */
export const StatCard = React.memo(({
  icon: Icon,
  value,
  label,
  description,
  tone = "primary",
}) => {
  const tones = {
    primary: "bg-[#173B5C]",
    accent: "bg-[#B48611]",
  };

  return (
    <div className="bg-[#FFFDF8] border border-[#EEE9DA] rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#8A7A4A]">
            {label}
          </p>

          <h3 className="text-3xl font-bold text-[#16263A] mt-2">
            {value}
          </h3>

          {description && (
            <p className="text-xs text-[#747B83] mt-1">
              {description}
            </p>
          )}
        </div>

        <div
          className={`
            w-12 h-12
            rounded-2xl
            ${tones[tone]}
            flex items-center justify-center
            shadow-sm
          `}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
});

/* ============================================================
   SoftRow
   Soft (cream) rounded container used for info/detail rows.
 ============================================================ */
export const SoftRow = React.memo(({
  icon: Icon,
  iconTone = "primary",
  children,
  className = "",
}) => {
  return (
    <div
      className={`
        rounded-2xl
        bg-[#F5F1E7]
        border border-[#E7E1D3]
        p-4
        flex items-center
        ${className}
      `}
    >
      {Icon && (
        <div className="w-9 h-9 rounded-lg bg-[#FFFDF8] border border-[#E7E1D3] flex items-center justify-center shrink-0">
          <Icon
            className={`w-4 h-4 ${
              iconTone === "accent"
                ? "text-[#B48611]"
                : "text-[#173B5C]"
            }`}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
});
