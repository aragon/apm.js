const ipfsAPI = require('ipfs-api')
const httpProvider = require('./http')()

module.exports = (opts = {}) => {
  const initIPFS = (rpc) => ipfsAPI(rpc)
  let ipfs

  return {
    identifier: 'ipfs',

    /**
     * Gets the file at `path` from the content URI `hash`.
     *
     * @param {string} hash The content URI hash
     * @param {string} path The path to the file
     * @return {Promise} A promise that resolves to the contents of the file
     */
    getFile (hash, path) {
      if (opts.gateway) {
        return httpProvider.getFile(`${opts.gateway}/${hash}`, path)
      }

      if (!ipfs) {
        ipfs = initIPFS(opts.rpc)
      }

      return ipfs.files.cat(`${hash}/${path}`)
        .then((file) => file.toString('utf8'))
    },

    /**
     * Gets the file stream at `path` from the content URI `hash`.
     *
     * @param {string} hash The content URI hash
     * @param {string} path The path to the file
     * @return {Stream} A stream representing the content of the file
     */
    getFileStream (hash, path) {
      if (opts.gateway) {
        return httpProvider.getFileStream(`${opts.gateway}/${hash}`, path)
      }

      if (!ipfs) {
        ipfs = initIPFS(opts.rpc)
      }

      return ipfs.files.catReadableStream(`${hash}/${path}`)
    },

    /**
     * Uploads all files from `path` and returns the content URI for those files.
     *
     * @param {string} path The path that contains files to upload
     * @return {Promise} A promise that resolves to the content URI of the files
     */
    async uploadFiles (path) {
      const hashes = await ipfs.util.addFromFs(path, { recursive: true })
      const { hash } = hashes.pop()

      return `ipfs:${hash}`
    }
  }
}
