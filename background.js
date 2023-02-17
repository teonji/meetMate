chrome.runtime.onMessage.addListener(async () => {
  browser.runtime.onMessage.addListener(
    () => {
      browser.tabs.executeScript({
        file: 'js/content.js',
      });
    },
  )
})
