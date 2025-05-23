// Mock for nanoid
let counter = 0;

module.exports = {
  nanoid: () => {
    counter++;
    return `test-id-${counter}`;
  }
}; 