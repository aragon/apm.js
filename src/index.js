import semver from 'semver'
import ens from './ens'
import promiseTimeout from './utils/timeout-promise.js'
import ipfs from './providers/ipfs'
import http from './providers/http'
//
const GAS_FUZZ_FACTOR = 1.5
const GET_INFO_TIMEOUT = 10000 //ms

export default (web3, options = {}) => {
  const defaultOptions = {
    ensRegistryAddress: null,
    providers: {},
  }
  options = Object.assign(defaultOptions, options)

  // Set up providers
  const defaultProviders = {
    ipfs: ipfs(options.ipfs),
    http: http(),
  }
  const providers = Object.assign(defaultProviders, options.providers)

  // Construct ENS options
  const ensOptions = {
    provider: web3.currentProvider,
    registryAddress: options.ensRegistryAddress,
  }

  const getProviderFromURI = (contentURI, path) => {
    const [contentProvider, contentLocation] = contentURI.split(/:(.+)/)

    if (!contentProvider || !contentLocation) {
      throw new Error(
        `Invalid content URI (expected format was "<provider>:<identifier>")`
      )
    }

    if (!providers[contentProvider]) {
      throw new Error(
        `The storage provider "${contentProvider}" is not supported`
      )
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
    version.split('.').map(part => parseInt(part))

  const getApplicationInfo = (
    contentURI,
    getInfoTimeout = GET_INFO_TIMEOUT
  ) => {
    const [provider, location] = contentURI.split(/:(.+)/)
    let error

    if (!provider || !location) {
      error = `contentURI: ${contentURI} is invalid.`
    } else if (!providers[provider]) {
      error = `Provider: ${provider} is not supported`
    }

    if (error) {
      return Promise.resolve({
        error,
        contentURI,
      })
    }

    return promiseTimeout(
      Promise.all([
        readFileFromApplication(contentURI, 'manifest.json'),
        readFileFromApplication(contentURI, 'artifact.json'),
      ]),
      getInfoTimeout
    )
      .then(files => files.map(JSON.parse))
      .then(([manifest, module]) => {
        const [provider, location] = contentURI.split(/:(.+)/)

        return Object.assign(manifest, module, {
          content: { provider, location },
        })
      })
      .catch(() => {
        const [provider, location] = contentURI.split(/:(.+)/)
        return {
          content: { provider, location },
        }
      })
  }

  function returnVersion(web3, getInfoTimeout) {
    return version => {
      const versionInfo = {
        contractAddress: version.contractAddress,
        version: version.semanticVersion.join('.'),
      }
      return getApplicationInfo(
        web3.utils.hexToAscii(version.contentURI),
        getInfoTimeout
      )
        .then(info => {
          return Object.assign(info, versionInfo)
        })
        .catch(err => versionInfo)
    }
  }

  function getRepoId(appId) {
    return appId
      .split('.')
      .slice(1)
      .join('.')
  }

  function getKernel(app) {
    return app.methods.kernel().call()
  }

  return {
    validInitialVersions: ['0.0.1', '0.1.0', '1.0.0'],
    getFile: readFileFromApplication,
    getFileStream: readFileStreamFromApplication,

    ensResolve: name => ens.resolve(name, ensOptions),

    /**
     * Get the APM repository registry address for `appId`.
     *
     * @param {string} appId
     * @return {Promise} A promise that resolves to the APM address
     */
    getRepoRegistryAddress(appId) {
      const repoId = getRepoId(appId)

      return this.ensResolve(repoId)
    },

    /**
     * Get the APM repository registry contract for `appId`.
     *
     * @param {string} appId
     * @return {Promise} A promise that resolves to the Web3 contract
     */
    getRepoRegistry(appId) {
      return this.getRepoRegistryAddress(appId).then(
        address =>
          new web3.eth.Contract(
            require('@aragon/os/abi/APMRegistry.json').abi,
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
    getRepository(appId) {
      return this.ensResolve(appId).then(
        address =>
          new web3.eth.Contract(
            require('@aragon/os/abi/Repo.json').abi,
            address
          )
      )
    },
    getVersion(appId, version, getInfoTimeout) {
      return this.getRepository(appId)
        .then(repository =>
          repository.methods.getBySemanticVersion(version).call()
        )
        .then(returnVersion(web3, getInfoTimeout))
    },
    getVersionById(appId, versionId, getInfoTimeout) {
      return this.getRepository(appId)
        .then(repository => repository.methods.getByVersionId(versionId).call())
        .then(returnVersion(web3, getInfoTimeout))
    },
    getLatestVersion(appId, getInfoTimeout) {
      return this.getRepository(appId)
        .then(repository => repository.methods.getLatest().call())
        .then(returnVersion(web3, getInfoTimeout))
    },
    getLatestVersionContract(appId) {
      return this.getRepository(appId)
        .then(repository => repository.methods.getLatest().call())
        .then(({ contractAddress }) => contractAddress)
    },
    getLatestVersionForContract(appId, address, getInfoTimeout) {
      return this.getRepository(appId)
        .then(repository =>
          repository.methods.getLatestForContractAddress(address).call()
        )
        .then(returnVersion(web3, getInfoTimeout))
    },
    getAllVersions(appId) {
      return this.getRepository(appId)
        .then(repository => repository.methods.getVersionsCount().call())
        .then(versionCount => {
          const versions = []
          for (let i = 1; i <= versionCount; i++) {
            versions.push(this.getVersionById(appId, i))
          }
          return Promise.all(versions)
        })
    },
    isValidBump(appId, fromVersion, toVersion) {
      return this.getRepository(appId).then(repo =>
        repo.methods
          .isValidBump(formatVersion(fromVersion), formatVersion(toVersion))
          .call()
      )
    },
    /**
     * Publishes a new version (`version`) of `appId` using storage provider `provider`.
     *
     * If the destination repository does not exist, it falls back to creating a new
     * repository with an initial version controlled by an initial manager.
     *
     * Returns the raw transaction to sign.
     *
     * @param {string} manager The address that will manage the new repo if it has to be created.
     * @param {string} appId The ENS name for the application repository.
     * @param {string} version A valid semantic version for this version.
     * @param {string} provider The name of an APM storage provider.
     * @param {string} directory The directory that contains files to publish.
     * @param {string} contract The new contract address for this version.
     * @param {string} from The account address we should estimate the gas with
     * @return {Promise} A promise that resolves to a raw transaction
     */
    async publishVersion(
      manager,
      appId,
      version,
      provider,
      directory,
      contract,
      from
    ) {
      const { targetContract, name, params } = await this.publishVersionIntent(
        manager,
        appId,
        version,
        provider,
        directory,
        contract
      )

      try {
        const call = targetContract.methods[name](...params)

        // Return transaction to sign
        return {
          to: targetContract.options.address,
          data: call.encodeABI(),
          gas: Math.round((await call.estimateGas({ from })) * GAS_FUZZ_FACTOR),
          gasPrice: web3.utils.toWei('10', 'gwei'),
        }
      } catch (err) {
        throw new Error(`Transaction would not succeed ("${err.message}")`)
      }
    },

    /**
     * Create an intent to publish a new version (`version`) of `appId` using storage provider `provider`.
     *
     * If the destination repository does not exist, the intent will be for creating a new
     * repository with an initial version.
     *
     * Returns an object with the needed components to execute an aragon.js intent
     *
     * @param {string} manager The address that will manage the new repo if it has to be created.
     * @param {string} appId The ENS name for the application repository.
     * @param {string} version A valid semantic version for this version.
     * @param {string} provider The name of an APM storage provider.
     * @param {string} directory The directory that contains files to publish.
     * @param {string} contract The new contract address for this version.
     * @return {Promise} A promise that resolves to an aragon.js intent
     */
    async publishVersionIntent(
      manager,
      appId,
      version,
      provider,
      directory,
      contract
    ) {
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
      const repo = await this.getRepository(appId).catch(() => null)

      // If the repo exists, create a new version in the repo
      if (repo !== null) {
        return {
          dao: await getKernel(repo),
          proxyAddress: repo.options.address,
          methodName: 'newVersion',
          params: [formatVersion(version), contract, `0x${contentURI}`],
          targetContract: repo,
        }
      } else {
        // If the repo does not exist yet, the intent will be for creating a repo with the first version
        const repoRegistry = await this.getRepoRegistry(appId).catch(() => {
          throw new Error(
            `Repository ${appId} does not exist and its registry does not exist`
          )
        })

        return {
          dao: await getKernel(repoRegistry),
          proxyAddress: repoRegistry.options.address,
          methodName: 'newRepoWithVersion',
          params: [
            appId.split('.')[0],
            manager,
            formatVersion(version),
            contract,
            `0x${contentURI}`,
          ],
          targetContract: repoRegistry,
        }
      }
    },
  }
}
