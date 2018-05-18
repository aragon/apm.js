const ipfs = require('./providers/ipfs')
const ens = require('./ens')
const semver = require('semver')

const GAS_FUZZ_FACTOR = 1.5

module.exports = (web3, options = {}) => {
  const defaultOptions = {
    ensRegistryAddress: null,
    providers: {}
  }
  options = Object.assign(
    defaultOptions,
    options
  )

  // Set up providers
  const defaultProviders = {
    ipfs: ipfs(options.ipfs)
  }
  const providers = Object.assign(
    defaultProviders,
    options.providers
  )

  // Construct ENS options
  const ensOptions = {
    provider: web3.currentProvider,
    registryAddress: options.ensRegistryAddress
  }

  const getProviderFromURI = (contentURI, path) => {
    const [contentProvider, contentLocation] = contentURI.split(/:(.+)/)

    if (!contentProvider || !contentLocation) {
      throw new Error(`Invalid content URI (expected format was "<provider>:<identifier>")`)
    }

    if (!providers[contentProvider]) {
      throw new Error(`The storage provider "${contentProvider}" is not supported`)
    }

    return { provider: providers[contentProvider], location: contentLocation }
  }

  const readFileFromApplication = (contentURI, path) => {
    const { provider, location } = getProviderFromURI(contentURI, path)
    return provider.getFile(location, path)
  }

  const readFileStreamFromApplication = (contentURI, path) => {
    const { provider, location } = getProviderFromURI(contentURI, path)
    return provider.getFileStream(location, path)
  }

  const formatVersion = version =>
    version.split('.').map((part) => parseInt(part))

  const getApplicationInfo = (contentURI) => {
    return Promise.all([
      readFileFromApplication(contentURI, 'manifest.json'),
      readFileFromApplication(contentURI, 'artifact.json')
    ])
      .then((files) => files.map(JSON.parse))
      .then(
        ([ manifest, module ]) => {
          const [provider, location] = contentURI.split(':')

          return Object.assign(
            manifest,
            module,
            { content: { provider, location } }
          )
        }
      )
      .catch(() => {
        const [provider, location] = contentURI.split(':')
        return {
          content: { provider, location }
        }
      })
  }

  function returnVersion (web3) {
    return (version) =>
      getApplicationInfo(web3.utils.hexToAscii(version.contentURI))
        .then((info) =>
          Object.assign(info, {
            contractAddress: version.contractAddress,
            version: version.semanticVersion.join('.')
          }))
  }

  return {
    validInitialVersions: ['0.0.1', '0.1.0', '1.0.0'],
    getFile: readFileFromApplication,
    getFileStream: readFileStreamFromApplication,

    ensResolve: (name) => ens.resolve(name, ensOptions),

    /**
     * Get the APM repository registry contract for `appId`.
     *
     * @param {string} appId
     * @return {Promise} A promise that resolves to the Web3 contract
     */
    getRepoRegistry (appId) {
      const repoId = appId.split('.').slice(1).join('.')

      return ens.resolve(repoId, ensOptions)
        .then(
          (address) => new web3.eth.Contract(
            require('@aragon/os/build/contracts/APMRegistry.json').abi,
            address
          )
        )
    },
    /**
     * Get the APM repository contract for `appId`.
     *
     * @param {string} appId
     * @return {Promise} A promise that resolves to the Web3 contract
     */
    getRepository (appId) {
      return ens.resolve(appId, ensOptions)
        .then(
          (address) => new web3.eth.Contract(
            require('@aragon/os/build/contracts/Repo.json').abi,
            address
          )
        )
    },
    getVersion (appId, version) {
      return this.getRepository(appId)
        .then((repository) =>
          repository.methods.getBySemanticVersion(version).call()
        )
        .then(returnVersion(web3))
    },
    getVersionById (appId, versionId) {
      return this.getRepository(appId)
        .then((repository) =>
          repository.methods.getByVersionId(versionId).call()
        )
        .then(returnVersion(web3))
    },
    getLatestVersion (appId) {
      return this.getRepository(appId)
        .then((repository) =>
          repository.methods.getLatest().call()
        )
        .then(returnVersion(web3))
    },
    getLatestVersionContract (appId) {
      return this.getRepository(appId)
        .then((repository) =>
          repository.methods.getLatest().call()
        )
        .then(({ contractAddress }) => contractAddress)
    },
    getLatestVersionForContract (appId, address) {
      return this.getRepository(appId)
        .then((repository) =>
          repository.methods.getLatestForContractAddress(address).call()
        )
        .then(returnVersion(web3))
    },
    getAllVersions (appId) {
      return this.getRepository(appId)
        .then((repository) =>
          repository.methods.getVersionsCount().call()
        )
        .then((versionCount) => {
          const versions = []
          for (let i = 1; i <= versionCount; i++) {
            versions.push(this.getVersionById(appId, i))
          }
          return Promise.all(versions)
        })
    },
    isValidBump (appId, fromVersion, toVersion) {
      return this.getRepository(appId)
        .then((repo) => (
          repo.methods.isValidBump(formatVersion(fromVersion), formatVersion(toVersion)).call()
        ))
    },
    /**
     * Publishes a new version (`version`) of `appId` using storage provider `provider`.
     *
     * If the destination repository does not exist, it falls back to creating a new
     * repository with an initial version.
     *
     * Returns the raw transaction to sign.
     *
     * @param {string} manager The address that has access to manage this repository.
     * @param {string} appId The ENS name for the application repository.
     * @param {string} version A valid semantic version for this version.
     * @param {string} provider The name of an APM storage provider.
     * @param {string} directory The directory that contains files to publish.
     * @param {string} contract The new contract address for this version.
     * @return {Promise} A promise that resolves to a raw transaction
     */
    async publishVersion (manager, appId, version, provider, directory, contract, from) {
      if (!semver.valid(version)) {
        throw new Error(`${version} is not a valid semantic version`)
      }

      if (!providers[provider]) {
        throw new Error(`The storage provider "${provider}" is not supported`)
      }

      // Upload files to storage provider
      const contentURI = Buffer.from(
        await providers[provider].uploadFiles(directory)
      ).toString('hex')

      // Resolve application repository
      const repo = await this.getRepository(appId)
        .catch(() => null)

      // Default call creates a new repository and publishes the initial version
      const repoRegistry = await this.getRepoRegistry(appId)
        .catch(() => {
          throw new Error(`Repository ${appId} does not exist and it's registry does not exist`)
        })

      let transactionDestination = repoRegistry.options.address
      let call = repoRegistry.methods.newRepoWithVersion(
        appId.split('.')[0],
        manager,
        formatVersion(version),
        contract,
        `0x${contentURI}`
      )

      // If the repository already exists, the call publishes a new version
      if (repo !== null) {
        transactionDestination = repo.options.address
        call = repo.methods.newVersion(
          formatVersion(version),
          contract,
          `0x${contentURI}`
        )
      }

      try {
        // Test that the call would actually succeed
        await call.call({ from })

        // Return transaction to sign
        return {
          to: transactionDestination,
          data: call.encodeABI(),
          gas: await call.estimateGas({ from }) * GAS_FUZZ_FACTOR,
          gasPrice: web3.utils.toWei('10', 'gwei'),
          nonce: await web3.eth.getTransactionCount(manager)
        }
      } catch (err) {
        throw new Error(`Transaction would not succeed ("${err.message}")`)
      }
    }
  }
}
