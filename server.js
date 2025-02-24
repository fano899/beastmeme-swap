require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bs58 = require("bs58");
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Global error handler for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    console.error("Bad JSON received:", err);
    return res.status(400).json({ error: "Malformed JSON in request body" });
  }
  next();
});

// Solana Configuration (using Helius RPC URL)
const SOLANA_RPC_URL = process.env.RPC_URL;
const connection = new Connection(SOLANA_RPC_URL, "confirmed");
const TOKEN_ADDRESS = new PublicKey(process.env.TOKEN_ADDRESS); // Your Beast Token Address
const SOL_WALLET = new PublicKey(process.env.SOL_WALLET); // Wallet to receive SOL
const EXCHANGE_RATE = 100000000; // Token Conversion Rate (1 SOL = 100,000,000 Beast tokens)
const MIN_PURCHASE_SOL = 0.1;
const sellerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY))
);

// Health Check Route
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Verify SOL Payment
async function verifySolPayment(sender, amount) {
  try {
    const signatures = await connection.getSignaturesForAddress(SOL_WALLET, { limit: 10 });
    for (let sig of signatures) {
      const transaction = await connection.getTransaction(sig.signature, { commitment: "confirmed" });
      if (transaction) {
        const senderMatch = transaction.transaction.message.accountKeys[0].toString() === sender;
        const transactionAmountSOL = transaction.transaction.message.instructions[0].lamports / 1000000000;  // Convert lamports to SOL
        const amountMatch = Math.abs(transactionAmountSOL - amount) < 0.01;
        if (senderMatch && amountMatch) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.error("Error verifying SOL payment:", error);
    return false;
  }
}

// Token Transfer Logic (Beast Token Transfer)
async function transferBeastTokens(sender, amount) {
  const senderTokenAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    TOKEN_ADDRESS,
    sender
  );

  const recipientTokenAccount = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    TOKEN_ADDRESS,
    sellerKeypair.publicKey
  );

  const transaction = new Transaction().add(
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      senderTokenAccount,
      recipientTokenAccount,
      sellerKeypair.publicKey,
      [],
      amount
    )
  );

  return sendAndConfirmTransaction(connection, transaction, [sellerKeypair]);
}

// Payment Route
app.post("/pay", async (req, res) => {
  console.log("Received request:", req.body); // Log the incoming request body
  
  try {
    const { sender, amount } = req.body;
    if (!sender || !amount || isNaN(amount)) {
      return res.status(400).json({ error: "Invalid data: 'sender' and 'amount' are required" });
    }
    if (amount < MIN_PURCHASE_SOL) {
      return res.status(400).json({ error: `Amount too low: Minimum purchase is ${MIN_PURCHASE_SOL} SOL` });
    }

    // Step 1: Verify the SOL payment
    const isPaid = await verifySolPayment(sender, amount);
    if (!isPaid) {
      return res.status(400).json({ error: "SOL payment not found or amount does not match" });
    }

    // Step 2: Calculate the Beast token amount
    const beastMemeAmount = amount * EXCHANGE_RATE; // Correct token conversion

    // Step 3: Transfer Beast tokens (NOT SOL)
    const signature = await transferBeastTokens(sender, beastMemeAmount);

    // Step 4: Return the successful response
    res.json({
      message: "Payment successful",
      transactionId: signature,
      amountReceived: beastMemeAmount
    });

  } catch (error) {
    console.error("Transaction failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

