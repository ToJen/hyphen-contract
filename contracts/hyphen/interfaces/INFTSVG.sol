// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISVGNFT {
    function backgroundUrl() external view returns (string memory);

    function getTokenSvg(
        uint256 _tokenId,
        uint256 _suppliedLiquidity,
        uint256 _totalSuppliedLiquidity
    ) external view returns (string memory);

    function owner() external view returns (address);

    function renounceOwnership() external;

    function setBackgroundPngUrl(string memory _backgroundPngUrl) external;

    function transferOwnership(address newOwner) external;
}
