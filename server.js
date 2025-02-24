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

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Solana Configuration
const SOLANA_RPC_URL = process.env.RPC_URL;
const connection = new Connection(SOLANA_RPC_URL, "confirmed");
const TOKEN_ADDRESS = new PublicKey(process.env.TOKEN_ADDRESS);
const SOL_WALLET = new PublicKey(process.env.SOL_WALLET);
const EXCHANGE_RATE = 100000000;
const MIN_PURCHASE_SOL = 0.1;
const sellerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY)));

// ✅ Health Check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ✅ Verify SOL Payment
async function verifySolPayment(sender, amount) {
  try {
    const signatures = await connection.getSignaturesForAddress(SOL_WALLET, { limit: 10 });
    for (let sig of signatures) {
      const transaction = await connection.getTransaction(sig.signature, { commitment: "confirmed" });
      if (transaction && transaction.transaction.message.accountKeys[0].toString() === sender) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error verifying SOL payment:", error);
    return false;
  }
}

// ✅ Payment Route
app.post("/pay", async (req, res) => {
  try {
    const { sender, amount } = req.body;
    if (!sender || !amount || isNaN(amount)) {
      return res.status(400).json({ error: "Invalid sender or amount" });
    }
    if (amount < MIN_PURCHASE_SOL) {
      return res.status(400).json({ error: `Minimum purchase amount is ${MIN_PURCHASE_SOL} SOL` });
    }
    const isPaid = await verifySolPayment(sender, amount);
    if (!isPaid) {
      return res.status(400).json({ error: "SOL payment not found" });
    }
    const beastMemeAmount = amount * EXCHANGE_RATE;
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sellerKeypair.publicKey,
        toPubkey: new PublicKey(sender),
        lamports: beastMemeAmount,
      })
    );
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
