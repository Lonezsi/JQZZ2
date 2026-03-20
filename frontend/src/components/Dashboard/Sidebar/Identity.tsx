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

  return (
    <div className="jqzz-identity" onClick={onClick}>
      <div className="jqzz-identity-row">
        <div className="jqzz-avatar">{avatarLetter}</div>
        <div>
          <div className="jqzz-identity-name">{identity.name}</div>
          <div className="jqzz-identity-handle">{identity.handle}</div>
        </div>
      </div>
    </div>
  );
};
