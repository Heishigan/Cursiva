(() => {
  // Try LinkedIn first
  const linkedInDesc = document.querySelector('.jobs-description__content');
  if (linkedInDesc) {
    return linkedInDesc.innerText;
  }
  
  // Try Greenhouse
  const greenhouseDesc = document.getElementById('content');
  if (greenhouseDesc) {
    return greenhouseDesc.innerText;
  }

  // Try Lever
  const leverDesc = document.querySelector('.posting-body');
  if (leverDesc) {
    return leverDesc.innerText;
  }
  
  // Fallback to full body text if no specific container is found
  return document.body.innerText;
})();
