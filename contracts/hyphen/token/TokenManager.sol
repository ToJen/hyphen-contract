// $$$$$$$$\        $$\                                 $$\      $$\
// \__$$  __|       $$ |                                $$$\    $$$ |
//    $$ | $$$$$$\  $$ |  $$\  $$$$$$\  $$$$$$$\        $$$$\  $$$$ | $$$$$$\  $$$$$$$\   $$$$$$\   $$$$$$\   $$$$$$\   $$$$$$\
//    $$ |$$  __$$\ $$ | $$  |$$  __$$\ $$  __$$\       $$\$$\$$ $$ | \____$$\ $$  __$$\  \____$$\ $$  __$$\ $$  __$$\ $$  __$$\
//    $$ |$$ /  $$ |$$$$$$  / $$$$$$$$ |$$ |  $$ |      $$ \$$$  $$ | $$$$$$$ |$$ |  $$ | $$$$$$$ |$$ /  $$ |$$$$$$$$ |$$ |  \__|
//    $$ |$$ |  $$ |$$  _$$<  $$   ____|$$ |  $$ |      $$ |\$  /$$ |$$  __$$ |$$ |  $$ |$$  __$$ |$$ |  $$ |$$   ____|$$ |
//    $$ |\$$$$$$  |$$ | \$$\ \$$$$$$$\ $$ |  $$ |      $$ | \_/ $$ |\$$$$$$$ |$$ |  $$ |\$$$$$$$ |\$$$$$$$ |\$$$$$$$\ $$ |
//    \__| \______/ \__|  \__| \_______|\__|  \__|      \__|     \__| \_______|\__|  \__| \_______| \____$$ | \_______|\__|
//                                                                                                 $$\   $$ |
//                                                                                                 \$$$$$$  |
//                                                                                                  \______/
// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../metatx/ERC2771Context.sol";
import "../interfaces/ITokenManager.sol";

contract TokenManager is ITokenManager, ERC2771Context, Ownable, Pausable {
    mapping(address => TokenInfo) public override tokensInfo;

    event FeeChanged(address indexed tokenAddress, uint256 indexed equilibriumFee, uint256 indexed maxFee);

    modifier tokenChecks(address tokenAddress) {
        require(tokenAddress != address(0), "Token address cannot be 0");
        require(tokensInfo[tokenAddress].supportedToken, "Token not supported");

        _;
    }

    /**
     * First key is toChainId and second key is token address being deposited on current chain
     */
    mapping(uint256 => mapping(address => TokenConfig)) public depositConfig;

    /**
     * Store min/max amount of token to transfer based on token address
     */
    mapping(address => TokenConfig) public transferConfig;

    constructor(address trustedForwarder) ERC2771Context(trustedForwarder) Ownable() Pausable() {
        // Empty Constructor
    }

    function getEquilibriumFee(address tokenAddress) public view override returns (uint256) {
        return tokensInfo[tokenAddress].equilibriumFee;
    }

    function getMaxFee(address tokenAddress) public view override returns (uint256) {
        return tokensInfo[tokenAddress].maxFee;
    }

    function changeFee(
        address tokenAddress,
        uint256 _equilibriumFee,
        uint256 _maxFee
    ) external override onlyOwner whenNotPaused {
        require(_equilibriumFee != 0, "Equilibrium Fee cannot be 0");
        require(_maxFee != 0, "Max Fee cannot be 0");
        require(_equilibriumFee <= _maxFee && _maxFee <= 10000000000, "Max Fee cannot be greater than 100%");
        tokensInfo[tokenAddress].equilibriumFee = _equilibriumFee;
        tokensInfo[tokenAddress].maxFee = _maxFee;
        emit FeeChanged(tokenAddress, tokensInfo[tokenAddress].equilibriumFee, tokensInfo[tokenAddress].maxFee);
    }

    function setTokenTransferOverhead(address tokenAddress, uint256 gasOverhead)
        external
        tokenChecks(tokenAddress)
        onlyOwner
    {
        tokensInfo[tokenAddress].transferOverhead = gasOverhead;
    }

    /**
     * Set DepositConfig for the given combination of toChainId, tokenAddress.
     * This is used while depositing token in Liquidity Pool. Based on the destination chainid
     * min and max deposit amount is checked.
     */
    function setDepositConfig(
        uint256[] memory toChainId,
        address[] memory tokenAddresses,
        TokenConfig[] memory tokenConfig
    ) external onlyOwner {
        require(
            (toChainId.length == tokenAddresses.length) && (tokenAddresses.length == tokenConfig.length),
            " ERR_ARRAY_LENGTH_MISMATCH"
        );
        uint256 length = tokenConfig.length;
        for (uint256 index; index < length; ) {
            depositConfig[toChainId[index]][tokenAddresses[index]].min = tokenConfig[index].min;
            depositConfig[toChainId[index]][tokenAddresses[index]].max = tokenConfig[index].max;
            unchecked {
                ++index;
            }
        }
    }

    function addSupportedToken(
        address tokenAddress,
        uint256 minCapLimit,
        uint256 maxCapLimit,
        uint256 equilibriumFee,
        uint256 maxFee,
        uint256 transferOverhead
    ) external onlyOwner {
        require(tokenAddress != address(0), "Token address cannot be 0");
        require(maxCapLimit > minCapLimit, "maxCapLimit > minCapLimit");
        tokensInfo[tokenAddress].supportedToken = true;
        transferConfig[tokenAddress].min = minCapLimit;
        transferConfig[tokenAddress].max = maxCapLimit;
        tokensInfo[tokenAddress].tokenConfig = transferConfig[tokenAddress];
        tokensInfo[tokenAddress].equilibriumFee = equilibriumFee;
        tokensInfo[tokenAddress].maxFee = maxFee;
        tokensInfo[tokenAddress].transferOverhead = transferOverhead;
    }

    function removeSupportedToken(address tokenAddress) external tokenChecks(tokenAddress) onlyOwner {
        tokensInfo[tokenAddress].supportedToken = false;
    }

    function updateTokenCap(
        address tokenAddress,
        uint256 minCapLimit,
        uint256 maxCapLimit
    ) external tokenChecks(tokenAddress) onlyOwner {
        require(maxCapLimit > minCapLimit, "maxCapLimit > minCapLimit");
        transferConfig[tokenAddress].min = minCapLimit;
        transferConfig[tokenAddress].max = maxCapLimit;
    }

    function getTokensInfo(address tokenAddress) public view override returns (TokenInfo memory) {
        TokenInfo memory tokenInfo = TokenInfo(
            tokensInfo[tokenAddress].transferOverhead,
            tokensInfo[tokenAddress].supportedToken,
            tokensInfo[tokenAddress].equilibriumFee,
            tokensInfo[tokenAddress].maxFee,
            transferConfig[tokenAddress]
        );
        return tokenInfo;
    }

    function getDepositConfig(uint256 toChainId, address tokenAddress)
        public
        view
        override
        returns (TokenConfig memory)
    {
        return depositConfig[toChainId][tokenAddress];
    }

    function getTransferConfig(address tokenAddress) public view override returns (TokenConfig memory) {
        return transferConfig[tokenAddress];
    }

    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address sender) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
