import axios from 'axios';

export default () => {
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
      const protocol = new RegExp('^https?://').test(host) ? '' : 'http://'
      return axios(`${protocol}${host}/${path}`, {
        responseType: 'text',

        // This is needed to disable the default behavior of axios, which
        // always tries to use JSON.parse() even if `responseType` is "text".
        //
        // See:
        //   https://github.com/axios/axios/issues/907#issuecomment-322054564
        //   https://github.com/axios/axios/issues/907#issuecomment-373988087
        transformResponse: undefined,
      }).then(response => response.data)
    },

    /**
     * Gets the file stream at `path` from the content URI `hash`.
     *
     * @param {string} hash The content URI hash
     * @param {string} path The path to the file
     * @return {Promise} A promise resolving to a stream representing the content of the file
     */
    async getFileStream (host, path) {
      return axios(`${host}/${path}`, { responseType: 'stream' })
        .then(response => response.data)
    },

    /**
     * Uploads all files from `path` and returns the content URI for those files.
     *
     * @param {string} url The url where the content will be served
     * @return {Promise} A promise that resolves to the content URI of the files
     */
    uploadFiles (url) {
      // We won't actually upload files since we will just
      // assume that files are available on this URL indefinitely.
      //
      // This is an OK assumption since this provider should really
      // only be used for development purposes.
      return `http:${url}`
    }
  }
};
