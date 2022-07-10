import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.15",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 50000,
          },
        },
      },
    ],
  },
};
