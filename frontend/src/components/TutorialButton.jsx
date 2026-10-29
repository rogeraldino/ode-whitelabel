import React from "react";

const TutorialButton = ({ onClick, label = "Tutorial", icon = null, ...props }) => (
  <button
    onClick={onClick}
    style={{
      background: "transparent",
      color: "#6B7280",
      border: "1px solid #D1D5DB",
      borderRadius: "6px",
      padding: "8px 12px",
      fontSize: "13px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "500",
      gap: "6px",
      transition: "all 0.15s ease",
      outline: "none",
      fontFamily: "Quicksand, sans-serif",
      position: "relative"
    }}
    aria-label={label}
    tabIndex={0}
    onMouseEnter={e => {
      e.currentTarget.style.background = "#F9FAFB";
      e.currentTarget.style.color = "#374151";
      e.currentTarget.style.borderColor = "#9CA3AF";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.color = "#6B7280";
      e.currentTarget.style.borderColor = "#D1D5DB";
    }}
    onFocus={e => {
      e.currentTarget.style.outline = "2px solid #DBEAFE";
      e.currentTarget.style.outlineOffset = "1px";
    }}
    onBlur={e => {
      e.currentTarget.style.outline = "none";
    }}
    {...props}
  >
    {icon || (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
      </svg>
    )}
    {label}
  </button>
);

export default TutorialButton;