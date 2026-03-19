import React from "react";

interface AddButtonProps {
  dropOver: boolean;
  onDropZoneDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDropZoneDragLeave: () => void;
  onDropZoneDrop: (e: React.DragEvent<HTMLElement>) => void;
}

export const AddButton: React.FC<AddButtonProps> = ({
  dropOver,
  onDropZoneDragOver,
  onDropZoneDragLeave,
  onDropZoneDrop,
}) => {
  return (
    <div
      className={`jqzz-add-btn${dropOver ? " over" : ""}`}
      onDragOver={onDropZoneDragOver}
      onDragLeave={onDropZoneDragLeave}
      onDrop={onDropZoneDrop}
      onClick={() => alert("Add new action block")}
    >
      {dropOver ? "✦ Release to add snippet" : "+ Add Action / Drop Snippet"}
    </div>
  );
};
