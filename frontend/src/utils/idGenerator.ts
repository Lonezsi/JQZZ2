let counter = 0;
export const generateId = (): number => {
  // Combine timestamp and counter to ensure uniqueness
  return Date.now() * 1000 + (counter++ % 1000);
};
