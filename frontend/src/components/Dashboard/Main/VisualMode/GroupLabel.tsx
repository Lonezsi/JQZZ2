import React from "react";

interface GroupLabelProps {
  questionNumber: number | string;
  questionText: string;
}

export const GroupLabel: React.FC<GroupLabelProps> = ({
  questionNumber,
  questionText,
}) => {
  return (
    <div className="jqzz-group-label">
      Q{questionNumber} — {questionText}
    </div>
  );
};
