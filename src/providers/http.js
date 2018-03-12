const got = require('got')

module.exports = (opts = {}) => {
  opts = Object.assign({
    host: 'http://localhost'
    port: 4522
  }, opts)

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
     * Uploads all files from `path` and returns the content URI for those files.
     *
     * @param {string} path The path that contains files to upload
     * @return {Promise} A promise that resolves to the content URI of the files
     */
    async uploadFiles (path) {
      // We won't actually upload files since we will just
      // assume that files are available on this URL indefinitely.
      //
      // This is an OK assumption since this provider should really
      // only be used for development purposes.
      return `http:${host}:${port}`
    }
  }
}
