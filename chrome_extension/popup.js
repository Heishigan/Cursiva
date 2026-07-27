document.addEventListener('DOMContentLoaded', () => {
  const mainView = document.getElementById('main-view');
  const bookmarkBtn = document.getElementById('bookmark-btn');
  const statusDiv = document.getElementById('status');

  const setupView = document.getElementById('setup-view');
  if (setupView) setupView.style.display = 'none';
  mainView.style.display = 'block';

  bookmarkBtn.addEventListener('click', async () => {
    statusDiv.innerText = "Authenticating with Cursiva...";
    statusDiv.style.color = "var(--text-primary)";
    bookmarkBtn.disabled = true;

    // 1. Find the Cursiva tab to get a fresh token dynamically
    let allTabs = await chrome.tabs.query({});
    let cursivaTabs = allTabs.filter(t => t.url && (t.url.includes('localhost:3000') || t.url.includes('cursiva.com')));
    
    if (cursivaTabs.length === 0) {
      statusDiv.innerText = "Error: Please keep Cursiva open in another tab to authenticate.";
      statusDiv.style.color = "red";
      bookmarkBtn.disabled = false;
      return;
    }

    try {
      const authResults = await chrome.scripting.executeScript({
        target: { tabId: cursivaTabs[0].id },
        world: 'MAIN',
        func: async () => {
          if (window.Clerk && window.Clerk.session) {
            return await window.Clerk.session.getToken();
          }
          return null;
        }
      });
      
      const token = authResults[0].result;
      if (!token) {
        statusDiv.innerText = "Error: You are not logged into Cursiva.";
        statusDiv.style.color = "red";
        bookmarkBtn.disabled = false;
        return;
      }

      statusDiv.innerText = "Extracting job description...";
      let [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const jd = results[0].result;
          statusDiv.innerText = "Sending to Cursiva...";
          
          fetch("http://localhost:8000/api/jobs/save", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              url: activeTab.url,
              job_description: jd
            })
          })
          .then(res => res.json())
          .then(data => {
            if (data.status === "success") {
              statusDiv.innerText = "Job saved successfully!";
              statusDiv.style.color = "green";
            } else {
              statusDiv.innerText = "Error: " + JSON.stringify(data);
              statusDiv.style.color = "red";
            }
          })
          .catch(err => {
            statusDiv.innerText = "Network error: " + err.message;
            statusDiv.style.color = "red";
          })
          .finally(() => {
            bookmarkBtn.disabled = false;
          });
        } else {
          statusDiv.innerText = "Failed to extract text from page.";
          statusDiv.style.color = "red";
          bookmarkBtn.disabled = false;
        }
      });
    } catch(e) {
      statusDiv.innerText = "Error accessing Cursiva tab: " + e.message;
      statusDiv.style.color = "red";
      bookmarkBtn.disabled = false;
    }
  });
});
