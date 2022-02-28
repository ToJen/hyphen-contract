import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  ERC20Token,
  LiquidityPool,
  LiquidityProvidersTest,
  WhitelistPeriodManager,
  LPToken,
  ExecutorManager,
  TokenManager,
  HyphenLiquidityFarming,
  // eslint-disable-next-line node/no-missing-import
} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

import { getLocaleString } from "./utils";

const advanceTime = async (secondsToAdvance: number) => {
  await ethers.provider.send("evm_increaseTime", [secondsToAdvance]);
  await ethers.provider.send("evm_mine", []);
};

const getElapsedTime = async (callable: any): Promise<number> => {
  const { timestamp: start } = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
  await callable();
  const { timestamp: end } = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
  return end - start;
};

describe("LiquidityFarmingTests", function () {
  let owner: SignerWithAddress, pauser: SignerWithAddress, bob: SignerWithAddress;
  let charlie: SignerWithAddress, tf: SignerWithAddress, executor: SignerWithAddress;
  let token: ERC20Token, token2: ERC20Token;
  let lpToken: LPToken;
  let wlpm: WhitelistPeriodManager;
  let liquidityProviders: LiquidityProvidersTest;
  let liquidityPool: LiquidityPool;
  let executorManager: ExecutorManager;
  let tokenManager: TokenManager;
  let farmingContract: HyphenLiquidityFarming;
  let trustedForwarder = "0xFD4973FeB2031D4409fB57afEE5dF2051b171104";
  const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  let BASE: BigNumber = BigNumber.from(10).pow(18);

  const perWalletMaxCap = getLocaleString(1000 * 1e18);
  const tokenMaxCap = getLocaleString(1000000 * 1e18);

  const perWalletNativeMaxCap = getLocaleString(1 * 1e18);
  const tokenNativeMaxCap = getLocaleString(200 * 1e18);

  beforeEach(async function () {
    [owner, pauser, charlie, bob, tf, , executor] = await ethers.getSigners();

    const tokenManagerFactory = await ethers.getContractFactory("TokenManager");
    tokenManager = (await tokenManagerFactory.deploy(tf.address)) as TokenManager;

    const erc20factory = await ethers.getContractFactory("ERC20Token");
    token = (await upgrades.deployProxy(erc20factory, ["USDT", "USDT"])) as ERC20Token;
    token2 = (await upgrades.deployProxy(erc20factory, ["USDC", "USDC"])) as ERC20Token;
    for (const signer of [owner, bob, charlie]) {
      await token.mint(signer.address, ethers.BigNumber.from(100000000).mul(ethers.BigNumber.from(10).pow(18)));
      await token2.mint(signer.address, ethers.BigNumber.from(100000000).mul(ethers.BigNumber.from(10).pow(18)));
    }
    await tokenManager.addSupportedToken(token.address, BigNumber.from(1), BigNumber.from(10).pow(30), 0, 0);
    await tokenManager.addSupportedToken(token2.address, BigNumber.from(1), BigNumber.from(10).pow(30), 0, 0);
    await tokenManager.addSupportedToken(NATIVE, BigNumber.from(1), BigNumber.from(10).pow(30), 0, 0);

    const executorManagerFactory = await ethers.getContractFactory("ExecutorManager");
    executorManager = (await executorManagerFactory.deploy()) as ExecutorManager;

    const lpTokenFactory = await ethers.getContractFactory("LPToken");
    lpToken = (await upgrades.deployProxy(lpTokenFactory, ["LPToken", "LPToken", tf.address])) as LPToken;

    const liquidtyProvidersFactory = await ethers.getContractFactory("LiquidityProvidersTest");
    liquidityProviders = (await upgrades.deployProxy(liquidtyProvidersFactory, [
      trustedForwarder,
      lpToken.address,
      tokenManager.address,
      pauser.address,
    ])) as LiquidityProvidersTest;
    await liquidityProviders.deployed();
    await lpToken.setLiquidtyPool(liquidityProviders.address);
    await liquidityProviders.setLpToken(lpToken.address);

    const wlpmFactory = await ethers.getContractFactory("WhitelistPeriodManager");
    wlpm = (await upgrades.deployProxy(wlpmFactory, [
      tf.address,
      liquidityProviders.address,
      tokenManager.address,
      lpToken.address,
      pauser.address,
    ])) as WhitelistPeriodManager;
    await wlpm.setLiquidityProviders(liquidityProviders.address);
    await liquidityProviders.setWhiteListPeriodManager(wlpm.address);
    await lpToken.setWhiteListPeriodManager(wlpm.address);
    await wlpm.setCaps(
      [token.address, NATIVE],
      [tokenMaxCap, tokenNativeMaxCap],
      [perWalletMaxCap, perWalletNativeMaxCap]
    );
    await wlpm.setAreWhiteListRestrictionsEnabled(false);

    const lpFactory = await ethers.getContractFactory("LiquidityPool");
    liquidityPool = (await upgrades.deployProxy(lpFactory, [
      executorManager.address,
      pauser.address,
      tf.address,
      tokenManager.address,
      liquidityProviders.address,
    ])) as LiquidityPool;
    await liquidityProviders.setLiquidityPool(liquidityPool.address);

    const farmingFactory = await ethers.getContractFactory("HyphenLiquidityFarming");
    farmingContract = (await upgrades.deployProxy(farmingFactory, [
      tf.address,
      pauser.address,
      liquidityProviders.address,
      lpToken.address,
    ])) as HyphenLiquidityFarming;
  });

  this.afterEach(async function () {
    expect(await token.balanceOf(liquidityProviders.address)).to.equal(0);
    expect(await token2.balanceOf(liquidityProviders.address)).to.equal(0);
    expect(await ethers.provider.getBalance(liquidityProviders.address)).to.equal(0);
  });

  it("Should be able to create reward pools", async function () {
    for (const signer of [owner, bob, charlie]) {
      await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
      for (const tk of [token, token2]) {
        await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
      }
    }

    await expect(farmingContract.initalizeRewardPool(token.address, token2.address, 10))
      .to.emit(farmingContract, "LogRewardPoolInitialized")
      .withArgs(token.address, token2.address, 10);
  });

  describe("Deposit", async () => {
    beforeEach(async function () {
      await farmingContract.initalizeRewardPool(token.address, token2.address, 10);

      for (const signer of [owner, bob, charlie]) {
        await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }

      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
    });

    it("Should be able to deposit lp tokens", async function () {
      await farmingContract.deposit(1, owner.address);
      expect((await farmingContract.userInfo(token.address, owner.address)).amount).to.equal(10);
      expect(await farmingContract.pendingToken(token.address, owner.address)).to.equal(0);
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([1].map(BigNumber.from));
    });

    it("Should be able to deposit lp tokens and delegate to another account", async function () {
      await farmingContract.deposit(1, bob.address);
      expect((await farmingContract.userInfo(token.address, bob.address)).amount).to.equal(10);
      expect(await farmingContract.pendingToken(token.address, bob.address)).to.equal(0);
      expect((await farmingContract.userInfo(token.address, owner.address)).amount).to.equal(0);
      expect(await farmingContract.pendingToken(token.address, owner.address)).to.equal(0);
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([1].map(BigNumber.from));
    });

    it("Should not be able to depoit LP token of un-initialized pools", async function () {
      await expect(farmingContract.deposit(2, owner.address)).to.be.revertedWith("ERR__POOL_NOT_INITIALIZED");
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([]);
    });

    it("Should be able to accrue token rewards", async function () {
      await farmingContract.deposit(1, owner.address);
      const time = await getElapsedTime(async () => {
        await advanceTime(100);
      });
      expect(await farmingContract.pendingToken(token.address, owner.address)).to.equal(time * 10);
    });

    it("Should be able to create deposits in different tokens", async function () {
      await farmingContract.initalizeRewardPool(token2.address, token.address, 10);
      await farmingContract.deposit(1, owner.address);
      const time = await getElapsedTime(async () => {
        await advanceTime(100);
        await farmingContract.deposit(2, owner.address);
        await advanceTime(100);
      });
      expect((await farmingContract.userInfo(token.address, owner.address)).amount).to.equal(10);
      expect(await farmingContract.pendingToken(token.address, owner.address)).to.equal(time * 10);
      expect((await farmingContract.userInfo(token2.address, owner.address)).amount).to.equal(10);
      expect(await farmingContract.pendingToken(token2.address, owner.address)).to.equal(1000);
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([1, 2].map(BigNumber.from));
    });
  });

  describe("Withdraw", async () => {
    beforeEach(async function () {
      await farmingContract.initalizeRewardPool(token.address, token2.address, 10);

      for (const signer of [owner, bob, charlie]) {
        await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }

      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
    });

    it("Should be able to withdraw nft", async function () {
      await farmingContract.deposit(1, owner.address);
      await expect(farmingContract.withdraw(1, owner.address)).to.emit(farmingContract, "LogWithdraw");
      expect(await lpToken.ownerOf(1)).to.equal(owner.address);
      expect(await farmingContract.getNftIdsStaked(owner.address)).to.deep.equal([]);
      expect((await farmingContract.userInfo(token.address, owner.address)).amount).to.equal(0);
    });

    it("Should prevent non owner from withdrawing nft", async function () {
      await farmingContract.deposit(1, bob.address);
      await expect(farmingContract.connect(bob).withdraw(1, bob.address)).to.be.revertedWith("ERR__NFT_NOT_STAKED");
      await expect(farmingContract.connect(owner).withdraw(2, bob.address)).to.be.revertedWith("ERR__NFT_NOT_STAKED");
    });
  });

  describe("Rewards", async () => {
    beforeEach(async function () {
      await farmingContract.initalizeRewardPool(token.address, token2.address, 10);
      await farmingContract.initalizeRewardPool(token2.address, token.address, 15);

      for (const signer of [owner, bob, charlie]) {
        await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }
    });

    it("Should be able to calculate correct rewards correctly", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 30);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 30);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      expect(await farmingContract.pendingToken(token.address, owner.address)).to.equal(
        Math.floor(100 * 10 + time1 * 10 + 300 * 10 + time2 * 10 + (500 * 10) / 4 + (time3 * 10) / 4 + (900 * 10) / 4)
      );
      expect(await farmingContract.pendingToken(token2.address, owner.address)).to.equal(
        Math.floor(300 * 15 + time2 * 15 + 500 * 15 + time3 * 15 + (900 * 15) / 4)
      );
      expect(await farmingContract.pendingToken(token.address, bob.address)).to.equal(
        Math.floor((500 * 10 * 3) / 4 + (time3 * 10 * 3) / 4 + (900 * 10 * 3) / 4)
      );
      expect(await farmingContract.pendingToken(token2.address, bob.address)).to.equal((900 * 15 * 3) / 4);
    });

    it("Should be able to calculate correct rewards correctly - 2", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 20);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 20);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      expect(await farmingContract.pendingToken(token.address, owner.address)).to.equal(
        Math.floor(100 * 10 + time1 * 10 + 300 * 10 + time2 * 10 + (500 * 10) / 3 + (time3 * 10) / 3 + (900 * 10) / 3)
      );
      expect(await farmingContract.pendingToken(token2.address, owner.address)).to.equal(
        Math.floor(300 * 15 + time2 * 15 + 500 * 15 + time3 * 15 + (900 * 15) / 3)
      );
      expect(await farmingContract.pendingToken(token.address, bob.address)).to.equal(
        Math.floor((500 * 10 * 2) / 3 + (time3 * 10 * 2) / 3 + (900 * 10 * 2) / 3)
      );
      expect(await farmingContract.pendingToken(token2.address, bob.address)).to.equal((900 * 15 * 2) / 3);
    });

    it("Should be able to calculate correct rewards correctly - 3", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 60);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 60);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      expect(await farmingContract.pendingToken(token.address, owner.address)).to.equal(
        Math.floor(100 * 10 + time1 * 10 + 300 * 10 + time2 * 10 + (500 * 10) / 7 + (time3 * 10) / 7 + (900 * 10) / 7)
      );
      expect(await farmingContract.pendingToken(token2.address, owner.address)).to.equal(
        Math.floor(300 * 15 + time2 * 15 + 500 * 15 + time3 * 15 + (900 * 15) / 7)
      );
      expect(await farmingContract.pendingToken(token.address, bob.address)).to.equal(
        Math.floor((500 * 10 * 6) / 7 + (time3 * 10 * 6) / 7 + (900 * 10 * 6) / 7)
      );
      expect(await farmingContract.pendingToken(token2.address, bob.address)).to.equal(Math.floor((900 * 15 * 6) / 7));
    });

    it("Should be able to send correct amount of rewards", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 60);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 60);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      const expectedRewards = {
        [token.address]: {
          [owner.address]: Math.floor(
            100 * 10 +
              time1 * 10 +
              300 * 10 +
              time2 * 10 +
              (500 * 10) / 7 +
              (time3 * 10) / 7 +
              (900 * 10) / 7 +
              (3 * 10) / 7 // Account for 3 transactions after this
          ),
          [bob.address]: Math.floor((500 * 10 * 6) / 7 + (time3 * 10 * 6) / 7 + (900 * 10 * 6) / 7 + (5 * 10 * 6) / 7),
        },
        [token2.address]: {
          [owner.address]: Math.floor(300 * 15 + time2 * 15 + 500 * 15 + time3 * 15 + (900 * 15) / 7 + (4 * 15) / 7),
          [bob.address]: Math.floor((900 * 15 * 6) / 7 + (6 * 15 * 6) / 7),
        },
      };

      await token.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));
      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await expect(() => farmingContract.extractRewards(token.address, owner.address)).to.changeTokenBalances(
        token2,
        [farmingContract, owner],
        [-expectedRewards[token.address][owner.address], expectedRewards[token.address][owner.address]]
      );
      await expect(() => farmingContract.extractRewards(token2.address, owner.address)).to.changeTokenBalances(
        token,
        [farmingContract, owner],
        [-expectedRewards[token2.address][owner.address], expectedRewards[token2.address][owner.address]]
      );
      await expect(() =>
        farmingContract.connect(bob).extractRewards(token.address, bob.address)
      ).to.changeTokenBalances(
        token2,
        [farmingContract, bob],
        [-expectedRewards[token.address][bob.address], expectedRewards[token.address][bob.address]]
      );
      await expect(() =>
        farmingContract.connect(bob).extractRewards(token2.address, bob.address)
      ).to.changeTokenBalances(
        token,
        [farmingContract, bob],
        [-expectedRewards[token2.address][bob.address], expectedRewards[token2.address][bob.address]]
      );
    });

    it("Should be able to send correct amount of rewards while adding lp token immediately if available", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token.address, 10);

      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      await expect(() => farmingContract.deposit(2, owner.address)).to.changeTokenBalances(
        token2,
        [farmingContract, owner],
        [-1010, 1010]
      );
    });

    it("Should be able to send correct amount of rewards while withdrawing lp token immediately if available", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);

      await token2.transfer(farmingContract.address, ethers.BigNumber.from(10).pow(18));

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      await expect(() => farmingContract.withdraw(1, owner.address)).to.changeTokenBalances(
        token2,
        [farmingContract, owner],
        [-1010, 1010]
      );
    });
  });

  describe("Rewards - NATIVE", async () => {
    beforeEach(async function () {
      await farmingContract.initalizeRewardPool(token.address, NATIVE, 10);
      await farmingContract.initalizeRewardPool(token2.address, NATIVE, 15);

      for (const signer of [owner, bob, charlie]) {
        await lpToken.connect(signer).setApprovalForAll(farmingContract.address, true);
        for (const tk of [token, token2]) {
          await tk.connect(signer).approve(farmingContract.address, ethers.constants.MaxUint256);
          await tk.connect(signer).approve(liquidityProviders.address, ethers.constants.MaxUint256);
        }
      }
    });

    it("Should be able to send correct amount of rewards", async function () {
      await liquidityProviders.addTokenLiquidity(token.address, 10);
      await liquidityProviders.addTokenLiquidity(token2.address, 10);
      await liquidityProviders.connect(bob).addTokenLiquidity(token.address, 60);
      await liquidityProviders.connect(bob).addTokenLiquidity(token2.address, 60);

      await farmingContract.deposit(1, owner.address);
      await advanceTime(100);
      const time1 = await getElapsedTime(async () => {
        await farmingContract.deposit(2, owner.address);
      });
      await advanceTime(300);
      const time2 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(3, bob.address);
      });
      await advanceTime(500);
      const time3 = await getElapsedTime(async () => {
        await farmingContract.connect(bob).deposit(4, bob.address);
      });
      await advanceTime(900);

      const expectedRewards = {
        [token.address]: {
          [owner.address]: Math.floor(
            100 * 10 +
              time1 * 10 +
              300 * 10 +
              time2 * 10 +
              (500 * 10) / 7 +
              (time3 * 10) / 7 +
              (900 * 10) / 7 +
              (2 * 10) / 7 // Account for 2 transactions after this
          ),
          [bob.address]: Math.floor((500 * 10 * 6) / 7 + (time3 * 10 * 6) / 7 + (900 * 10 * 6) / 7 + (4 * 10 * 6) / 7),
        },
        [token2.address]: {
          [owner.address]: Math.floor(300 * 15 + time2 * 15 + 500 * 15 + time3 * 15 + (900 * 15) / 7 + (3 * 15) / 7),
          [bob.address]: Math.floor((900 * 15 * 6) / 7 + (5 * 15 * 6) / 7),
        },
      };

      await owner.sendTransaction({
        to: farmingContract.address,
        value: ethers.BigNumber.from(10).pow(18),
      });

      await expect(() => farmingContract.extractRewards(token.address, owner.address)).to.changeEtherBalances(
        [farmingContract, owner],
        [-expectedRewards[token.address][owner.address], expectedRewards[token.address][owner.address]]
      );
      await expect(() => farmingContract.extractRewards(token2.address, owner.address)).to.changeEtherBalances(
        [farmingContract, owner],
        [-expectedRewards[token2.address][owner.address], expectedRewards[token2.address][owner.address]]
      );
      await expect(() =>
        farmingContract.connect(bob).extractRewards(token.address, bob.address)
      ).to.changeEtherBalances(
        [farmingContract, bob],
        [-expectedRewards[token.address][bob.address], expectedRewards[token.address][bob.address]]
      );
      await expect(() =>
        farmingContract.connect(bob).extractRewards(token2.address, bob.address)
      ).to.changeEtherBalances(
        [farmingContract, bob],
        [-expectedRewards[token2.address][bob.address], expectedRewards[token2.address][bob.address]]
      );
    });
  });
});