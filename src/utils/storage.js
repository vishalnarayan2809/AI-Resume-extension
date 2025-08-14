export const storage = {
  get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (res) => resolve(res));
    });
  },
  set(obj) {
    return new Promise((resolve) => {
      chrome.storage.local.set(obj, () => resolve(true));
    });
  },
  remove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => resolve(true));
    });
  },
};
