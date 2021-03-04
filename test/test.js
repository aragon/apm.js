const APM = require("../src");
const {
  DEFAULT_IPFS_TIMEOUT,
  getLocalWeb3,
  getApmRegistryName,
  getApmOptions,
} = require("./test-helpers");

const posttest = require("./posttest");

let web3, apmRegistryName, apmOptions, apm, accounts;

/* Setup and cleanup */
jest.setTimeout(60000);
beforeAll(async () => {
  web3 = await getLocalWeb3();
  accounts = await web3.eth.getAccounts();

  apmRegistryName = getApmRegistryName();
  apmOptions = getApmOptions();
  apm = APM(web3, apmOptions);
});

afterAll(async () => {
  await posttest();
});

test("APM exists", () => {
  expect(APM).toBeDefined();
});

test("getRepoRegistryAddress", async () => {
  const repoRegistryAddress = await apm.getRepoRegistryAddress(
    "voting.aragonpm.eth"
  );
  expect(repoRegistryAddress).toBe(
    "0x32296d9f8fed89658668875dc73cacf87e8888b2"
  );
});

test("getRepoRegistry", async () => {
  const repoRegistry = await apm.getRepoRegistry("voting.aragonpm.eth");
  expect(repoRegistry).toBeDefined();
});

test("getRepository", async () => {
  const repository = await apm.getRepository("voting.aragonpm.eth");
  expect(repository).toBeDefined();
});

test("getVersion", async () => {
  const version = await apm.getVersion(
    "voting.aragonpm.eth",
    "1.0.0".split("."),
    DEFAULT_IPFS_TIMEOUT
  );
  expect(version.version).toBe("1.0.0");
  expect(version.content.location).toBe(
    "Qmd7MWNsKWioNwPjdM8ZPCLFpS58erpM6C2dEVcPWtrg44"
  );
  expect(version.content.provider).toBe("ipfs");
});

test("getVersionById", async () => {
  const version = await apm.getVersionById(
    "voting.aragonpm.eth",
    "1",
    DEFAULT_IPFS_TIMEOUT
  );
  expect(version.version).toBe("1.0.0");
  expect(version.content.location).toBe(
    "Qmd7MWNsKWioNwPjdM8ZPCLFpS58erpM6C2dEVcPWtrg44"
  );
  expect(version.content.provider).toBe("ipfs");
});

test("getLatestVersion", async () => {
  const latestVersion = await apm.getLatestVersion(
    "voting.aragonpm.eth",
    DEFAULT_IPFS_TIMEOUT
  );
  expect(latestVersion.version).toBe("1.0.0");
  expect(latestVersion.content.location).toBe(
    "Qmd7MWNsKWioNwPjdM8ZPCLFpS58erpM6C2dEVcPWtrg44"
  );
  expect(latestVersion.content.provider).toBe("ipfs");
});

test("getLatestVersionContract", async () => {
  const latestVersion = await apm.getLatestVersionContract(
    "voting.aragonpm.eth"
  );
  expect(latestVersion).toBe("0xb31E9e3446767AaDe9E48C4B1B6D13Cc6eDce172");
});

test("getAllVersions", async () => {
  const allVersions = await apm.getAllVersions(
    "voting.aragonpm.eth",
    DEFAULT_IPFS_TIMEOUT
  );
  expect(allVersions.length).toBeGreaterThan(0);
  expect(allVersions[0].version).toBe("1.0.0");
  expect(allVersions[0].content.location).toBe(
    "Qmd7MWNsKWioNwPjdM8ZPCLFpS58erpM6C2dEVcPWtrg44"
  );
  expect(allVersions[0].content.provider).toBe("ipfs");
});

test("publishVersion", async () => {
  const publishTx = await apm.publishVersion(
    accounts[0],
    "newapp.aragonpm.eth",
    "1.0.0",
    "http",
    "./tmp",
    accounts[0],
    accounts[0]
  );

  expect(publishTx).toBeDefined();
  expect(publishTx.data).toBeDefined();
  expect(Number(publishTx.gas)).toBeGreaterThan(0);
  expect(Number(publishTx.gasPrice)).toBeGreaterThanOrEqual(1e9);
  expect(publishTx.to.startsWith("0x")).toBe(true);
});

test("publishVersionIntent", async () => {
  const intent = await apm.publishVersionIntent(
    accounts[0],
    "newapp.aragonpm.eth",
    "1.0.0",
    "http",
    "./tmp",
    accounts[0]
  );

  expect(intent).toBeDefined();
  expect(intent.dao.startsWith("0x")).toBe(true);
  expect(intent.methodName).toBe("newRepoWithVersion");
  expect(intent.params.length).toBe(5);
  expect(intent.proxyAddress.startsWith("0x")).toBe(true);
  expect(intent.targetContract).toBeDefined();
});
