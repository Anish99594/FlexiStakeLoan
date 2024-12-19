import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACTADDRESS, CONTRACTABI } from "./abi/constants";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { toast } from "react-hot-toast";

import "./App.css";

const App = () => {
  const [account, setAccount] = useState(null);
  const [userType, setUserType] = useState("borrower"); // "admin", "lender", "borrower"
  const [loading, setLoading] = useState(false);
  const [borrowAmount, setBorrowAmount] = useState("");
  const [duration, setDuration] = useState(0); // 0: 30 Days, 1: 90 Days, 2: 180 Days
  const [stakeAmount, setStakeAmount] = useState("");
  const [lendAmount, setLendAmount] = useState("");
  const [borrowerAddress, setBorrowerAddress] = useState("");
  const [borrowerDetails, setBorrowerDetails] = useState({
    stakedAmount: 0,
    borrowedAmount: 0,
    lastUpdated: 0,
    lastStakeRewardClaimed: 0,
    loanDuration: 0,
    loanStartTime: 0,
  });
  const [lenderInfo, setLenderInfo] = useState({
    lentAmount: 0,
    lastUpdated: 0,
  });

  const { writeContractAsync, isPending } = useWriteContract();
  const { address } = useAccount();

  const handleUserAction = (type) => {
    setUserType(type);
  };

  // Validate positive integer input
  const handlePositiveIntegerChange = (e, setter) => {
    const value = e.target.value;
    if (value === "" || /^(\d+(\.\d{0,18})?|0\.\d{0,18})$/.test(value)) {
      // Only allow numbers
      setter(value);
    }
  };

  const { data: borrowingInfo, isError: borrowerError } = useReadContract({
    address: CONTRACTADDRESS,
    abi: CONTRACTABI,
    functionName: "borrowers",
    args: [address],
  });

  const { data: LenderData, isError: LenderError } = useReadContract({
    address: CONTRACTADDRESS,
    abi: CONTRACTABI,
    functionName: "lenders",
    args: [address],
  });

  console.log(LenderData);

  // Stake Tokens
  const stakeTokens = async (e) => {
    e.preventDefault();

    // Validate the input amount (should be greater than 0)
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    try {
      // Convert the stake amount to wei (for ETH)
      const stakeValue = ethers.utils.parseEther(stakeAmount);

      // Send the stake transaction to the smart contract
      const transaction = await writeContractAsync({
        address: CONTRACTADDRESS,
        abi: CONTRACTABI,
        functionName: "stakeTokens",
        value: stakeValue,
      });

      console.log(transaction);

      toast.success("Tokens Staked successfully!");
    } catch (error) {
      // Handle specific errors
      if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
        toast.error(
          "Transaction failed: Gas estimation failed. Please try again."
        );
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        toast.error("Transaction failed: Insufficient funds.");
      } else if (error.code === "USER_REJECTED") {
        toast.warning("Transaction cancelled by user.");
      } else if (error.message.includes("Amount must be greater than zero")) {
        toast.error("Amount must be greater than zero.");
      } else if (error.message.includes("Max stake limit reached")) {
        toast.error("Transaction failed: Max stake limit reached.");
      } else if (error.message.includes("notBlacklisted")) {
        toast.error("Transaction failed: You are blacklisted.");
      } else if (error.message.includes("revert")) {
        // Handle contract revert errors
        if (error.message.includes("Max stake limit reached")) {
          toast.error("Max stake limit reached. Try staking a smaller amount.");
        } else if (error.message.includes("You are blacklisted")) {
          toast.error("You are blacklisted and cannot stake tokens.");
        } else {
          toast.error(
            "Transaction failed: Contract reverted. Please try again."
          );
        }
      } else if (error.message.includes("out of gas")) {
        toast.error(
          "Transaction failed: Out of gas. Please increase the gas limit."
        );
      } else {
        // For all other errors
        console.error(error);
        toast.error(`Stake failed: ${error.message || error}`);
      }
    }
  };

  // Borrow Tokens function
  const borrowTokens = async (e) => {
    e.preventDefault();

    // Validate borrow amount
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    // Convert to Wei (XFI)
    const borrowValue = ethers.utils.parseEther(borrowAmount);

    // Validate duration
    if (![0, 1, 2].includes(duration)) {
      toast.error("Invalid loan duration selected.");
      return;
    }

    try {
      // Send transaction to borrow tokens
      const transaction = await writeContractAsync({
        address: CONTRACTADDRESS,
        abi: CONTRACTABI,
        functionName: "borrowTokens",
        args: [borrowValue, duration],
      });

      console.log(transaction);

      toast.success("Tokens borrowed successfully!");
    } catch (error) {
      // Handle specific errors
      if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
        toast.error(
          "Transaction failed: Gas estimation failed. Please try again."
        );
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        toast.error("Transaction failed: Insufficient funds.");
      } else if (error.code === "USER_REJECTED") {
        toast.warning("Transaction cancelled by user.");
      } else if (error.message.includes("Amount must be greater than zero")) {
        toast.error("Amount must be greater than zero.");
      } else if (error.message.includes("revert")) {
        // Smart contract revert errors
        if (error.message.includes("Max borrow limit reached")) {
          toast.error("Transaction failed: Max borrow limit reached.");
        } else if (error.message.includes("No staked tokens")) {
          toast.error("Transaction failed: No staked tokens available.");
        } else if (error.message.includes("Borrow amount exceeds limit")) {
          toast.error("Transaction failed: Borrow amount exceeds limit.");
        } else if (error.message.includes("Contract balance insufficient")) {
          toast.error("Transaction failed: Contract balance insufficient.");
        } else {
          toast.error(
            "Transaction failed: Contract reverted. Please try again."
          );
        }
      } else if (error.message.includes("out of gas")) {
        toast.error(
          "Transaction failed: Out of gas. Please increase the gas limit."
        );
      } else {
        // For all other errors
        console.error(error);
        toast.error(`Borrow failed: ${error.message || error}`);
      }
    }
  };

  // Repay Borrowed Tokens
  const repayBorrowedTokens = async (e) => {
    e.preventDefault();

    // Validate the input amount (should be greater than 0)
    if (
      !borrowerDetails.borrowedAmount ||
      parseFloat(borrowerDetails.borrowedAmount) <= 0
    ) {
      toast.error("No borrowed amount to repay");
      return;
    }

    try {
      // Convert the repayment amount to wei (for ETH)
      const repaymentAmount = ethers.utils.parseEther(
        borrowerDetails.borrowedAmount.toString()
      );

      // Send the repayment transaction to the smart contract
      const transaction = await writeContractAsync({
        address: CONTRACTADDRESS,
        abi: CONTRACTABI,
        functionName: "repayBorrowedTokens",
        value: repaymentAmount,
      });

      console.log(transaction);

      toast.success("Borrowed amount repaid successfully!");
    } catch (error) {
      // Handle specific errors
      if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
        toast.error(
          "Transaction failed: Gas estimation failed. Please try again."
        );
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        toast.error("Transaction failed: Insufficient funds.");
      } else if (error.code === "USER_REJECTED") {
        toast.warning("Transaction cancelled by user.");
      } else if (error.message.includes("No borrowed amount to repay")) {
        toast.error("No borrowed amount to repay.");
      } else if (error.message.includes("Insufficient repayment amount")) {
        toast.error("Transaction failed: Insufficient repayment amount.");
      } else if (error.message.includes("revert")) {
        toast.error("Transaction failed: Contract reverted. Please try again.");
      } else if (error.message.includes("out of gas")) {
        toast.error(
          "Transaction failed: Out of gas. Please increase the gas limit."
        );
      } else {
        // For all other errors
        console.error(error);
        toast.error(`Repayment failed: ${error.message || error}`);
      }
    }
  };

  // Lend Tokens
  const lendTokens = async (e) => {
    e.preventDefault();

    // Check if the lend amount is valid
    if (!lendAmount || parseFloat(lendAmount) <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    try {
      // Convert lendAmount to wei (XFI)
      const lendValue = ethers.utils.parseEther(lendAmount);

      // Send the lend transaction to the smart contract
      const transaction = await writeContractAsync({
        address: CONTRACTADDRESS, // Your contract address
        abi: CONTRACTABI, // Your contract ABI
        functionName: "lendTokens", // Smart contract function name
        args: [], // No additional arguments needed for lendTokens
        value: lendValue, // Value to send with the transaction
      });

      console.log(transaction);

      // Success message
      toast.success("Tokens lent successfully!");
    } catch (error) {
      // Handle specific errors
      if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
        toast.error(
          "Transaction failed: Gas estimation failed. Please try again."
        );
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        toast.error("Transaction failed: Insufficient funds.");
      } else if (error.code === "USER_REJECTED") {
        toast.warning("Transaction cancelled by user.");
      } else if (error.message.includes("Amount must be greater than zero")) {
        toast.error("Amount must be greater than zero.");
      } else if (error.message.includes("revert")) {
        // Smart contract revert errors
        if (error.message.includes("Insufficient liquidity")) {
          toast.error(
            "Transaction failed: Insufficient liquidity in the contract."
          );
        } else if (error.message.includes("Invalid amount")) {
          toast.error("Transaction failed: Invalid lending amount.");
        } else {
          toast.error(
            "Transaction failed: Contract reverted. Please try again."
          );
        }
      } else if (error.message.includes("out of gas")) {
        toast.error(
          "Transaction failed: Out of gas. Please increase the gas limit."
        );
      } else {
        // For all other errors
        console.error(error);
        toast.error(`Lend failed: ${error.message || error}`);
      }
    }
  };

  // Withdraw Lent Funds
  const withdrawLentFunds = async (e) => {
    e.preventDefault();

    try {
      // Send transaction to withdraw lent funds
      const transaction = await writeContractAsync({
        address: CONTRACTADDRESS,
        abi: CONTRACTABI,
        functionName: "withdrawLentFunds",
      });

      console.log(transaction);

      // Success message
      toast.success("Tokens withdrawn successfully!");
    } catch (error) {
      // Handle specific errors
      if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
        toast.error(
          "Transaction failed: Gas estimation failed. Please try again."
        );
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        toast.error("Transaction failed: Insufficient funds.");
      } else if (error.code === "USER_REJECTED") {
        toast.warning("Transaction cancelled by user.");
      } else if (error.message.includes("No lent funds")) {
        toast.error("You have no lent funds to withdraw.");
      } else if (error.message.includes("revert")) {
        // Handle contract revert errors
        if (error.message.includes("No lent funds")) {
          toast.error("No lent funds available for withdrawal.");
        } else {
          toast.error(
            "Transaction failed: Contract reverted. Please try again."
          );
        }
      } else if (error.message.includes("out of gas")) {
        toast.error(
          "Transaction failed: Out of gas. Please increase the gas limit."
        );
      } else {
        // For all other errors
        console.error(error);
        toast.error(`Error: ${error.message || error}`);
      }
    }
  };

  // Handle Loan Default (Admin only)
  const handleLoanDefault = async (borrowerAddress) => {
    try {
      // Check if the borrower address is valid
      if (!ethers.utils.isAddress(borrowerAddress)) {
        alert("Invalid borrower address");
        return;
      }

      // Call the handleLoanDefault function from the smart contract
      const transaction = await writeContractAsync({
        address: CONTRACTADDRESS,
        abi: CONTRACTABI,
        functionName: "handleLoanDefault",
        args: [borrowerAddress],
      });

      console.log(transaction);

      // Success message
      toast.success("Loan default handled successfully!");

      setBorrowerAddress("");
    } catch (error) {
      // Handle any errors that occur during the process
      if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
        alert("Transaction failed. Please try again.");
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        alert("Insufficient funds to perform the action.");
      } else {
        alert(`Error: ${error.message}`);
      }
    }
  };

  const removeFromBlacklist = async (borrowerAddress) => {
    try {
      // Check if the borrower address is valid
      if (!ethers.utils.isAddress(borrowerAddress)) {
        alert("Invalid borrower address");
        return;
      }

      const tx = await writeContractAsync({
        address: CONTRACTADDRESS,
        abi: CONTRACTABI,
        functionName: "removeFromBlacklist",
        args: [borrowerAddress],
      });

      console.log(transaction);

      // Success message
      toast.success("User removed from blacklist successfully!");

      setBorrowerAddress("");
    } catch (error) {
      // Handle errors that occur during the process
      if (error.code === "UNPREDICTABLE_GAS_LIMIT") {
        alert("Transaction failed. Please try again.");
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        alert("Insufficient funds to perform the action.");
      } else if (error.message.includes("User is not blacklisted")) {
        alert("This user is not blacklisted.");
      } else {
        alert(`Error: ${error.message}`);
      }
    }
  };

  useEffect(() => {
    const getBorrowerDetails = async () => {
      try {
        // Log raw borrowingInfo to confirm its structure
        console.log("Raw borrowingInfo:", borrowingInfo);

        // Ensure borrowingInfo is an array with 6 elements
        if (!Array.isArray(borrowingInfo) || borrowingInfo.length !== 6) {
          throw new Error("Invalid data format returned from the contract");
        }

        // Destructure the values correctly
        const [
          stakedAmount,
          borrowedAmount,
          lastUpdated,
          lastStakeRewardClaimed,
          loanDuration,
          loanStartTime,
        ] = borrowingInfo;

        // Type checks for BigInt
        if (
          typeof stakedAmount !== "bigint" ||
          typeof borrowedAmount !== "bigint" ||
          typeof lastUpdated !== "bigint" ||
          typeof lastStakeRewardClaimed !== "bigint" ||
          typeof loanStartTime !== "bigint"
        ) {
          console.error("Expected BigInt types but received:", borrowingInfo);
          throw new Error("Invalid data format returned from the contract");
        }

        // Ensure loanDuration is treated as BigInt (if it isn't already)
        const loanDurationBigInt = BigInt(loanDuration); // Convert to BigInt if not already

        // Format the values to a readable format
        const formattedDetails = {
          stakedAmount: ethers.utils.formatEther(stakedAmount),
          borrowedAmount: ethers.utils.formatEther(borrowedAmount),
          lastUpdated: new Date(Number(lastUpdated) * 1000).toLocaleString(),
          lastStakeRewardClaimed: new Date(
            Number(lastStakeRewardClaimed) * 1000
          ).toLocaleString(),
          loanDuration: loanDurationBigInt.toString(), // Ensure it's a string
          loanStartTime: new Date(
            Number(loanStartTime) * 1000
          ).toLocaleString(),
        };

        console.log("Formatted Details:", formattedDetails);

        // Update the state with the formatted details
        setBorrowerDetails(formattedDetails);

        // Show success toast
        toast.success("Borrower details fetched successfully");
      } catch (error) {
        console.error("Detailed error:", error);
        toast.error("Failed to fetch borrower details");
      }
    };

    if (borrowingInfo) {
      getBorrowerDetails(); // Fetch borrower details when user is a borrower
    }
  }, [borrowingInfo, borrowerError]);

  useEffect(() => {
    const processLenderData = () => {
      try {
        if (LenderData && !LenderError) {
          console.log("Lender Data:", LenderData);

          // Assuming LenderData is an array with the structure:
          // [lentAmount (uint256), lastUpdated (uint256)]
          const formattedLenderInfo = {
            lentAmount: ethers.utils.formatEther(LenderData[0]), // Convert to Ether from Wei
            lastUpdated: Number(LenderData[1]), // Convert BigInt timestamp to a number
          };

          setLenderInfo(formattedLenderInfo);
          console.log("Formatted Lender Info:", formattedLenderInfo);
          toast.success("Lender details fetched successfully");
        } else if (LenderError) {
          console.error("Error fetching lender data:", LenderError);
        }
      } catch (error) {
        console.error("Error processing lender data:", error);
      }
    };

    if (LenderData) {
      processLenderData();
    }
  }, [LenderData, LenderError]);

  const mapLoanDuration = (loanDuration) => {
    switch (loanDuration) {
      case "0":
        return "30 Days";
      case "1":
        return "90 Days";
      case "2":
        return "180 Days";
      default:
        return "Unknown Duration";
    }
  };

  return (
    <div className="container">
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        FlexiStakeLoan
      </h1>
      <ConnectButton />
      <div className="user-actions">
        <button onClick={() => handleUserAction("borrower")}>Borrower</button>
        <button onClick={() => handleUserAction("lender")}>Lender</button>
        <button onClick={() => handleUserAction("admin")}>Admin</button>
      </div>

      {/* Borrower Section */}
      {userType === "borrower" && (
        <div className="section">
          <h3>Borrower Actions</h3>

          <form>
            <label htmlFor="stakeAmount">Amount to Stake</label>
            <input
              type="number"
              id="stakeAmount"
              placeholder="Amount in XFI"
              value={stakeAmount}
              onChange={(e) => handlePositiveIntegerChange(e, setStakeAmount)}
            />
            <button type="button" onClick={stakeTokens}>
              Stake Tokens
            </button>
          </form>
          <form>
            <label htmlFor="borrowAmount">Amount to Borrow</label>
            <input
              type="number"
              id="borrowAmount"
              placeholder="Amount in XFI"
              value={borrowAmount}
              onChange={(e) => handlePositiveIntegerChange(e, setBorrowAmount)}
            />
            <label htmlFor="loanDuration">Loan Duration</label>
            <select
              id="loanDuration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              <option value="0">30 Days</option>
              <option value="1">90 Days</option>
              <option value="2">180 Days</option>
            </select>
            <button type="button" onClick={borrowTokens}>
              Borrow Tokens
            </button>
            <button type="button" onClick={repayBorrowedTokens}>
              Repay Borrowed Tokens
            </button>
            <div>
              <p>Staked Amount: {borrowerDetails.stakedAmount} XFI</p>
              <p>Borrowed Amount: {borrowerDetails.borrowedAmount} XFI</p>
              <p>
                Loan Duration: {mapLoanDuration(borrowerDetails.loanDuration)}
              </p>
              <p>
                Loan Start Time:
                {borrowerDetails.loanStartTime}
              </p>
              <p>
                Last Updated:
                {borrowerDetails.lastUpdated}
              </p>
              <p>
                Last Stake Reward Claimed:
                {borrowerDetails.lastStakeRewardClaimed}
              </p>
            </div>
          </form>
        </div>
      )}

      {/* Lender Section */}
      {userType === "lender" && (
        <div className="section">
          <h3>Lender Actions</h3>

          <form>
            <label htmlFor="lendAmount">Amount to Lend</label>
            <input
              type="number"
              id="lendAmount"
              placeholder="Amount in ETH"
              value={lendAmount}
              onChange={(e) => handlePositiveIntegerChange(e, setLendAmount)}
            />
            <button type="button" onClick={lendTokens}>
              Lend Tokens
            </button>
          </form>
          <button
            type="button"
            onClick={withdrawLentFunds}
            style={{
              marginTop: "20px",
              display: "block",
              marginRight: "auto",
              marginLeft: "auto",
            }}
          >
            Withdraw Lent Funds
          </button>
          <div>
            <p>Lent Amount: {lenderInfo.lentAmount} XFI</p>
            <p>
              Last Updated:{" "}
              {lenderInfo.lastUpdated > 0
                ? new Date(lenderInfo.lastUpdated * 1000).toLocaleString()
                : "N/A"}
            </p>
          </div>
        </div>
      )}

      {/* Admin Section */}
      {userType === "admin" && (
        <div className="section">
          <h3 style={{ textAlign: "center" }}>Admin Actions</h3>

          {/* Borrower Address Input */}

          <form>
            <label htmlFor="borrowerAddress">Borrower Address</label>
            <input
              type="text"
              id="borrowerAddress"
              placeholder="Enter borrower address"
              value={borrowerAddress}
              onChange={(e) => setBorrowerAddress(e.target.value)}
            />

            <button
              type="button"
              onClick={handleLoanDefault} // Trigger handleLoanDefault with dynamic address
            >
              Handle Loan Default
            </button>

            <button
              type="button"
              onClick={removeFromBlacklist} // Trigger removeFromBlacklist with dynamic address
            >
              Remove User from Blacklist
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
