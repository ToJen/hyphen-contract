// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWhiteListPeriodManager {
    function areWhiteListRestrictionsEnabled() external view returns (bool);

    function beforeLiquidityAddition(
        address _lp,
        address _token,
        uint256 _amount
    ) external;

    function beforeLiquidityRemoval(
        address _lp,
        address _token,
        uint256 _amount
    ) external;

    function beforeLiquidityTransfer(
        address _from,
        address _to,
        address _token,
        uint256 _amount
    ) external;

    function getMaxCommunityLpPositon(address _token) external view returns (uint256);

    function initialize(address _trustedForwarder, address _liquidityPool) external;

    function isExcludedAddress(address) external view returns (bool);

    function isInstitutionalLp(address) external view returns (bool);

    function isTrustedForwarder(address forwarder) external view returns (bool);

    function liquidityAddedByCommunityLp(address, address) external view returns (uint256);

    function liquidityPool() external view returns (address);

    function owner() external view returns (address);

    function paused() external view returns (bool);

    function perTokenCommunityCap(address) external view returns (uint256);

    function perTokenTotalCap(address) external view returns (uint256);

    function perWalletCapForCommunityLp(address) external view returns (uint256);

    function renounceOwnership() external;

    function setAreWhiteListRestrictionsEnabled(bool _status) external;

    function setCap(
        address _token,
        uint256 _totalCap,
        uint256 _communityCap,
        uint256 _perWalletCap
    ) external;

    function setCaps(
        address[] memory _tokens,
        uint256[] memory _totalCaps,
        uint256[] memory _communityCaps,
        uint256[] memory _perWalletCaps
    ) external;

    function setCommunityCap(address _token, uint256 _communityCap) external;

    function setInstitutionalLpStatus(address[] memory _addresses, bool[] memory _status) external;

    function setLiquidityPool(address _liquidityPool) external;

    function setPerWalletCapForCommunityLp(address _token, uint256 _perWalletCap) external;

    function setTotalCap(address _token, uint256 _totalCap) external;

    function setisExcludedAddressStatus(address[] memory _addresses, bool[] memory _status) external;

    function totalLiquidityAddedByCommunityLps(address) external view returns (uint256);

    function totalLiquidityAddedByInstitutionalLps(address) external view returns (uint256);

    function transferOwnership(address newOwner) external;
}