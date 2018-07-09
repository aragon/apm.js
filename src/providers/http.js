const got = require('got')

module.exports = () => {
  return {
    identifier: 'http',

    /**
     * Gets the file at `path` from the content URI `host`.
     *
     * @param {string} host The content URI host
     * @param {string} path The path to the file
     * @return {Promise} A promise that resolves to the contents of the file
     */
    getFile (host, path) {
      return got(`${host}/${path}`)
        .then((response) => response.body)
    },

    /**
     * Gets the file stream at `path` from the content URI `hash`.
     *
     * @param {string} hash The content URI hash
     * @param {string} path The path to the file
     * @return {Stream} A stream representing the content of the file
     */
    getFileStream (host, path) {
      return got.stream(`${host}/${path}`)
    },

    /**
     * Uploads all files from `path` and returns the content URI for those files.
     *
     * @param {string} url The url where the content will be served
     * @return {Promise} A promise that resolves to the content URI of the files
     */
    async uploadFiles (url) {
      // We won't actually upload files since we will just
      // assume that files are available on this URL indefinitely.
      //
      // This is an OK assumption since this provider should really
      // only be used for development purposes.
      return `http:${url}`
    }
  }
}
