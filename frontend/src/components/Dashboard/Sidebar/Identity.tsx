import React from "react";
import type { User } from "../../../types";

interface IdentityProps {
  identity: User | null;
  onClick: () => void;
}

export const Identity: React.FC<IdentityProps> = ({ identity, onClick }) => {
  if (!identity) {
    return (
      <div className="jqzz-identity" onClick={onClick}>
        <div className="jqzz-identity-row">
          <div className="jqzz-avatar">?</div>
          <div>
            <div className="jqzz-identity-name">Set your identity</div>
            <div className="jqzz-identity-handle">click to register</div>
          </div>
        </div>
      </div>
    );
  }

  const avatarLetter = identity.name ? identity.name[0].toUpperCase() : "?";
  const avatarStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
  };
  const onlineDotStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "0px",
    right: "0px",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "var(--lime, #a3e635)",
    border: "2px solid var(--bg1)",
    boxShadow: "0 0 2px rgba(0,0,0,0.2)",
  };

  return (
    <div className="jqzz-identity" onClick={onClick}>
      <div className="jqzz-identity-row">
        <div style={avatarStyle}>
          <div className="jqzz-avatar">{avatarLetter}</div>
          {identity.online && <div style={onlineDotStyle} />}
        </div>
        <div>
          <div className="jqzz-identity-name">{identity.name}</div>
          <div className="jqzz-identity-handle">{identity.handle}</div>
        </div>
      </div>
    </div>
  );
};
