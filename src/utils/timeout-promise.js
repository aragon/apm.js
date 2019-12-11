// https://italonascimento.github.io/applying-a-timeout-to-your-promises/
module.exports = function(promise, ms) {
  // Create a promise that rejects in <ms> milliseconds
  let timeoutInstance;
  const timeout = new Promise((resolve, reject) => {
    timeoutInstance = setTimeout(() => {
      reject(Error("Timed out in " + ms + "ms."));
    }, ms);
  });

  // Returns a race between our timeout and the passed in promise
  return Promise.race([promise, timeout]).then(res => {
    clearTimeout(timeoutInstance);
    return res;
  }).catch(e => {
    clearTimeout(timeoutInstance);
    throw e
  })
};
