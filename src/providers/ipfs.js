globalThis = global
const createClient = require('ipfs-http-client')
const httpProvider = require('./http')()
const all = require('it-all')

module.exports = (opts = {}) => {
  // Backwards compatible API: If rpc is passed in options that is passed to IPFS,
  // otherwise all options are provided
  const initIPFS = (ipfsOptions) =>
    ipfsOptions.rpc ? createClient(ipfsOptions.rpc) : createClient(ipfsOptions)

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
    async getFile (hash, path) {
      if (opts.gateway) {
        return httpProvider.getFile(`${opts.gateway}/${hash}`, path)
      }

      if (!ipfs) {
        ipfs = initIPFS(opts)
      }

      const file = await all(ipfs.cat(`${hash}/${path}`))

      return file.toString('utf8')
    },

    /**
     * Gets the file stream at `path` from the content URI `hash`.
     *
     * @param {string} hash The content URI hash
     * @param {string} path The path to the file
     * @return {Promise} A promise that resolves to a stream representing the content of the file
     */
    async getFileStream (hash, path) {
      if (opts.gateway) {
        return httpProvider.getFileStream(`${opts.gateway}/${hash}`, path)
      }

      if (!ipfs) {
        ipfs = initIPFS(opts)
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
      if (!ipfs) {
        ipfs = initIPFS(opts)
      }

      const hashes = await ipfs.util.addFromFs(path, { recursive: true })
      const { hash } = hashes.pop()

      return `ipfs:${hash}`
    }
  }
}