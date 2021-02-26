const APM = require("../src")
const { 
  getLocalWeb3, 
  getApmRegistryName, 
  getApmOptions,
  DEFAULT_IPFS_TIMEOUT
} = require("./test-helpers")

let web3, apmRegistryName, apmOptions, apm

/* Setup and cleanup */
jest.setTimeout(60000)
beforeAll(async () => {
  web3 = await getLocalWeb3()

  apmRegistryName = getApmRegistryName()
  apmOptions = getApmOptions()
  apm = APM(web3, apmOptions)

})

test("APM exists", () => {
  expect(APM).toBeDefined()
})

test("getRepoRegistryAddress", async () => {
  const repoRegistryAddress = await apm.getRepoRegistryAddress("voting.aragonpm.eth")
  expect(repoRegistryAddress).toBe('0x32296d9f8fed89658668875dc73cacf87e8888b2')
})

test("getRepoRegistry", async () => {
  const repoRegistry = await apm.getRepoRegistry("voting.aragonpm.eth")
  expect(repoRegistry).toBeDefined()
})

test("getRepository", async () => {
  const repository = await apm.getRepository("voting.aragonpm.eth")
  expect(repository).toBeDefined()
})

test("getVersion", async () => {
  const version = await apm.getVersion("voting.aragonpm.eth", '1.0.0'.split('.'), DEFAULT_IPFS_TIMEOUT)
  expect(version.version).toBe('1.0.0')
  expect(version.content.location).toBe('Qmd7MWNsKWioNwPjdM8ZPCLFpS58erpM6C2dEVcPWtrg44')
  expect(version.content.provider).toBe('ipfs')
})

test("getVersionById", async () => {
  const version = await apm.getVersionById("voting.aragonpm.eth", '1', DEFAULT_IPFS_TIMEOUT)
  expect(version.version).toBe('1.0.0')
  expect(version.content.location).toBe('Qmd7MWNsKWioNwPjdM8ZPCLFpS58erpM6C2dEVcPWtrg44')
  expect(version.content.provider).toBe('ipfs')
})

test("getLatestVersion", async () => {
  const latestVersion = await apm.getLatestVersion("voting.aragonpm.eth", DEFAULT_IPFS_TIMEOUT)
  expect(latestVersion.version).toBe('1.0.0')
  expect(latestVersion.content.location).toBe('Qmd7MWNsKWioNwPjdM8ZPCLFpS58erpM6C2dEVcPWtrg44')
  expect(latestVersion.content.provider).toBe('ipfs')
})

test("getLatestVersionContract", async () => {
  const latestVersion = await apm.getLatestVersionContract("voting.aragonpm.eth")
  expect(latestVersion).toBe('0xb31E9e3446767AaDe9E48C4B1B6D13Cc6eDce172')
})

test("getAllVersions", async () => {
  const allVersions = await apm.getAllVersions("voting.aragonpm.eth", DEFAULT_IPFS_TIMEOUT)
  expect(allVersions.length).toBeGreaterThan(0)
  expect(allVersions[0].version).toBe('1.0.0')
  expect(allVersions[0].content.location).toBe('Qmd7MWNsKWioNwPjdM8ZPCLFpS58erpM6C2dEVcPWtrg44')
  expect(allVersions[0].content.provider).toBe('ipfs')
})

// TODO
test.skip("publishVersion", async () => {
  
})

test.skip("publishVersionIntent", async () => {

})