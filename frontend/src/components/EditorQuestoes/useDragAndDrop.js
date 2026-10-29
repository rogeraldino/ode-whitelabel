import { useState } from 'react';

export default function useDragAndDrop(list, setList) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.target.classList.add('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    if (draggedIndex === null) return;
    const newList = [...list];
    const [item] = newList.splice(draggedIndex, 1);
    newList.splice(targetIndex, 0, item);
    setList(newList);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = (e) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    e.target.classList.remove('dragging');
  };

  return { draggedIndex, dragOverIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}
