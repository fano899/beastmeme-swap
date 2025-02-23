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
const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Solana Configuration
const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"; // ✅ Use Mainnet
const connection = new Connection(SOLANA_RPC_URL);
const TOKEN_ADDRESS = new PublicKey(process.env.TOKEN_ADDRESS); // BEAST MEME token mint address
const SOL_WALLET = new PublicKey(process.env.SOL_WALLET); // SOL wallet that receives SOL payments
const EXCHANGE_RATE = 100000000; // 1 SOL = 100,000,000 BEAST MEME
const MIN_PURCHASE_SOL = 0.1; // 🔹 Minimum 0.1 SOL purchase

// 🔹 Load the seller's private key from .env file
const sellerPrivateKey = Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY));
const sellerKeypair = Keypair.fromSecretKey(sellerPrivateKey);

// ✅ Health Check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ✅ Payment Route (Handles SOL ➝ BEAST MEME)
app.post("/pay", async (req, res) => {
  try {
    const { sender, amount } = req.body;
    if (!sender || !amount || isNaN(amount)) {
      return res.status(400).json({ error: "Invalid sender or amount" });
    }

    // 🔹 Enforce minimum purchase amount
    if (amount < MIN_PURCHASE_SOL) {
      return res.status(400).json({ error: `Minimum purchase amount is ${MIN_PURCHASE_SOL} SOL` });
    }

    // 🔹 Calculate BEAST MEME amount to send
    const beastMemeAmount = amount * EXCHANGE_RATE;

    // 🔹 Find buyer's associated token account
    const buyerPublicKey = new PublicKey(sender);
    const buyerTokenAccount = await getAssociatedTokenAddress(
      TOKEN_ADDRESS,
      buyerPublicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // 🔹 Check if buyer has a token account; create one if not
    const buyerTokenAccountInfo = await connection.getAccountInfo(buyerTokenAccount);
    let createAccountInstruction;
    if (!buyerTokenAccountInfo) {
      createAccountInstruction = createAssociatedTokenAccountInstruction(
        sellerKeypair.publicKey,
        buyerTokenAccount,
        buyerPublicKey,
        TOKEN_ADDRESS,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
    }

    // 🔹 Create transaction to send BEAST MEME
    const transaction = new Transaction();
    if (createAccountInstruction) {
      transaction.add(createAccountInstruction);
    }

    transaction.add(
      createTransferInstruction(
        await getAssociatedTokenAddress(TOKEN_ADDRESS, sellerKeypair.publicKey),
        buyerTokenAccount,
        sellerKeypair.publicKey,
        beastMemeAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // 🔹 Send transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [sellerKeypair]);
    res.json({ message: "Payment successful", transactionId: signature, amountReceived: beastMemeAmount });

  } catch (error) {
    console.error("Transaction failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
