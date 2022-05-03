import { ethers } from "hardhat";
import { parseUnits } from "ethers/lib/utils";
import { deploy, IDeployConfig } from "./helpers";

(async () => {
  const config: IDeployConfig = {
    trustedForwarder: "0x86C80a8aa58e0A4fa09A69624c31Ab2a6CAD56b8",
    bicoOwner: "0xd76b82204be75ab9610b04cf27c4f4a34291d5e6",
    pauser: "0x144A36059cdc0eF8e192ddC4df6E6d2F013fDa6A",
    tokens: [
      // USDT
      {
        tokenAddress: "0x55d398326f99059ff775485246999027b3197955",
        minCap: parseUnits("100", 6),
        maxCap: parseUnits("120000", 6),
        depositConfigs: [
          {
            chainId: 137,
            minCap: parseUnits("10", 6),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("50000", 6),
          },
          {
            chainId: 1,
            minCap: parseUnits("10", 6),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("100,000", 6),
          },
        ],
        equilibriumFee: parseUnits("0.075", 8),
        maxFee: parseUnits("0.5", 8),
        transferOverhead: 82491, // TODO
        maxWalletLiquidityCap: parseUnits("10000", 6), // not used
        maxLiquidityCap: parseUnits("578829", 6), // trevor
        svgHelper: await ethers.getContractFactory("BSCUSDT"),
        decimals: 6,
        rewardTokenAddress: "0x06250a4962558F0F3E69FC07F4c67BB9c9eAc739",
        rewardRatePerSecond: parseUnits("0.002247835648148150", 18), // trevor
        excessStateTransferFeePer: parseUnits("0.045", 8),
      },
      // USDC
      {
        tokenAddress: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        minCap: parseUnits("100", 6),
        maxCap: parseUnits("221813", 6),
        depositConfigs: [
          {
            chainId: 137,
            minCap: parseUnits("10", 6),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("200000", 6),
          },
          {
            chainId: 43114,
            minCap: parseUnits("10", 6),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("200000", 6),
          },
          {
            chainId: 1,
            minCap: parseUnits("10", 6),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("200000", 6),
          },
        ],
        equilibriumFee: ethers.utils.parseUnits("0.075", 8),
        maxFee: ethers.utils.parseUnits("0.5", 8),
        transferOverhead: 89491, // TODO
        maxWalletLiquidityCap: parseUnits("10000", 6), // not used
        maxLiquidityCap: parseUnits("1643855", 6), // trevor
        svgHelper: await ethers.getContractFactory("BSCUSDC"),
        decimals: 6,
        rewardTokenAddress: "0x06250a4962558F0F3E69FC07F4c67BB9c9eAc739",
        rewardRatePerSecond: parseUnits("0.006383761574074080", 18), // trevor 
        excessStateTransferFeePer: parseUnits("0.045", 8),
      },
      // BICO
      {
        tokenAddress: "0x06250a4962558F0F3E69FC07F4c67BB9c9eAc739",
        minCap: parseUnits("50", 18),
        maxCap: parseUnits("510000", 18),
        depositConfigs: [
          {
            chainId: 137,
            minCap: parseUnits("10", 18),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("113220", 18),
          },
          {
            chainId: 1,
            minCap: parseUnits("10", 18),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("530,000", 18),
          },
        ],
        equilibriumFee: ethers.utils.parseUnits("0.075", 8),
        maxFee: ethers.utils.parseUnits("0.5", 8),
        transferOverhead: 85949, // TODO
        maxWalletLiquidityCap: parseUnits("8474.57", 18),  // not used
        maxLiquidityCap: parseUnits("610350", 18), // trevor
        svgHelper: await ethers.getContractFactory("BSCBICO"),
        decimals: 18,
        rewardTokenAddress: "0x06250a4962558F0F3E69FC07F4c67BB9c9eAc739",
        rewardRatePerSecond: parseUnits("0", 18),
        excessStateTransferFeePer: parseUnits("0.045", 8),
      },
      // ETH
      {
        tokenAddress: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
        // when user is exiting : sendFundsToUser
        minCap: parseUnits("0.02", 18),
        maxCap: parseUnits("143", 18),

        // when user is depositing on bsc: depositErc20/depositNative, 
        depositConfigs: [
          {
            chainId: 137,
            minCap: parseUnits("0.0039", 18),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("130", 18),
          },
          {
            chainId: 43114,
            minCap: parseUnits("0.0039", 18),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("130", 18),
          },
          {
            chainId: 1,
            minCap: parseUnits("0.0039", 18),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: parseUnits("130", 18),
          },
        ],
        equilibriumFee: ethers.utils.parseUnits("0.075", 8),
        maxFee: ethers.utils.parseUnits("0.5", 8),
        transferOverhead: 59271, // TODO
        maxWalletLiquidityCap: parseUnits("3.86", 18), // not used
        maxLiquidityCap: parseUnits("1774", 18), //trevor
        svgHelper: await ethers.getContractFactory("BSCETH"),
        decimals: 18,
        rewardTokenAddress: "0x06250a4962558F0F3E69FC07F4c67BB9c9eAc739",
        rewardRatePerSecond: parseUnits("0.017809687500000000", 18), // trevor 
        excessStateTransferFeePer: parseUnits("0.045", 8),
      },
    ],
  };
  await deploy(config);
})();
